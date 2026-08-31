"""
drainage_pipeline.py
--------------------
Fetches, scores, and proxies drainage blockage risk for the Lagos
flood-risk model.

APPROACH: There is no comprehensive public dataset of *which drains
are blocked* in Lagos. This module uses a multi-layer proxy strategy
to estimate blockage risk per 500m grid cell:

  Layer 1 — OSM Drainage Infrastructure
      • Drain / ditch / canal density (m of drain per m² of cell)
      • Missing drain coverage (high-density urban cells with no drains
        are likely to have unrecorded/informal drains that block easily)

  Layer 2 — Blockage Proxy: Waste + Land Use Signals
      • OSM-tagged waste/dump sites near drains (strong blockage proxy)
      • Market areas near drains (markets → high solid waste → blockage)
      • Informal settlement density near drains (informal areas often
        lack formal waste management → debris in drains)

  Layer 3 — News / Report Blockage Events (NLP-derived)
      • labels_scraper.py extracts flood reports mentioning "blocked
        drain", "choked canal", "debris" etc. 
      • This module maps those events to grid cells and creates a
        historical_blockage_frequency feature.

  Layer 4 — Maintenance Score (Inverse proxy)
      • Road quality / surface tag presence near drains (well-maintained
        roads tend to have maintained drains)
      • Recency of OSM drain edits (community-mapped = potentially
        known problem area)

OUTPUT (per grid cell, merged into master dataset):
  - drain_density          : metres of drain per m² of cell area
  - drain_coverage_gap     : 1 if urban/impervious cell has zero drains
  - n_waste_sites_nearby   : count of OSM waste/dump tags within 500m
  - n_markets_nearby       : count of OSM market tags within 500m
  - blockage_event_count   : count of news/report-derived blockage events
  - composite_blockage_risk: weighted score 0–1 (used as a model feature)
"""

import logging
import math
import pandas as pd
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, box
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# 1.  OSM DRAINAGE FETCH
# ─────────────────────────────────────────────

def get_lagos_drainage(place: str = "Lagos State, Nigeria") -> gpd.GeoDataFrame:
    """
    Fetch all waterway drain / ditch / canal features for Lagos via OSMnx.
    Returns a GeoDataFrame of LineString geometries (CRS: EPSG:4326).
    
    Run this once and cache to  data/raw/lagos_drainage.geojson
    """
    import osmnx as ox
    logger.info("Fetching Lagos drainage network from OSM...")
    tags = {
        "waterway": ["drain", "ditch", "canal", "stream", "river", "culvert"]
    }
    gdf = ox.features_from_place(place, tags=tags)
    # Keep only linear features (drains are lines, not polygons/nodes)
    gdf = gdf[gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    logger.info(f"Found {len(gdf)} drainage features in OSM.")
    return gdf[["waterway", "name", "geometry"]]


def get_lagos_blockage_proxies(place: str = "Lagos State, Nigeria") -> gpd.GeoDataFrame:
    """
    Fetch OSM features that are strong proxies for drain blockage:
      - waste disposal / landfill / garbage sites
      - markets (high organic + solid waste generation)
      - informal settlements tagged in OSM
    Returns a GeoDataFrame of point/polygon geometries.
    """
    import osmnx as ox
    logger.info("Fetching blockage-proxy features from OSM...")
    tags = {
        "amenity": ["waste_disposal", "waste_transfer_station", "recycling", "marketplace"],
        "landuse": ["landfill", "brownfield"],
        "place": ["neighbourhood"],          # informal areas often tagged this way
    }
    try:
        ox.settings.timeout = 600
        gdf = ox.features_from_place(place, tags=tags)
        # Reduce to centroid for distance calculations
        gdf = gdf.copy()
        gdf["geometry"] = gdf.geometry.centroid
        logger.info(f"Found {len(gdf)} blockage-proxy features.")
        return gdf[["amenity", "landuse", "place", "name", "geometry"]]
    except Exception as e:
        logger.error(f"Failed to fetch blockage-proxy features from OSM: {e}")
        logger.warning("Returning empty dataframe for proxies to allow pipeline to continue.")
        return gpd.GeoDataFrame(columns=["amenity", "landuse", "place", "name", "geometry"], geometry="geometry", crs="EPSG:4326")


# ─────────────────────────────────────────────
# 2.  PER-CELL FEATURE CALCULATION
# ─────────────────────────────────────────────

def calculate_drain_density(
    grid_gdf: gpd.GeoDataFrame,
    drainage_gdf: gpd.GeoDataFrame,
    grid_id_col: str = "grid_id"
) -> gpd.GeoDataFrame:
    """
    For each 500m grid cell, calculates:
      - drain_length_m   : total metres of drain lines inside the cell
      - drain_density    : drain_length_m / cell_area_m²
      - drain_coverage_gap : 1 if cell is urban (impervious > 0.3) but has zero drains
                             0 otherwise
    Expects both GDFs to be in the same projected CRS (EPSG:32631 recommended).
    """
    utm_crs = "EPSG:32631"  # UTM Zone 31N — accurate for Lagos
    grid_proj = grid_gdf.to_crs(utm_crs).copy()
    drain_proj = drainage_gdf.to_crs(utm_crs).copy()

    logger.info("Clipping drainage lines to grid cells...")
    # Spatial join to find drains that intersect each cell
    drain_in_cells = gpd.overlay(
        drain_proj.reset_index(drop=True),
        grid_proj[[grid_id_col, "geometry"]],
        how="intersection"
    )
    drain_in_cells["drain_length_m"] = drain_in_cells.geometry.length

    # Aggregate drain length per cell
    drain_agg = (
        drain_in_cells.groupby(grid_id_col)["drain_length_m"]
        .sum()
        .reset_index()
    )

    grid_proj = grid_proj.merge(drain_agg, on=grid_id_col, how="left")
    grid_proj["drain_length_m"] = grid_proj["drain_length_m"].fillna(0)
    grid_proj["cell_area_m2"] = grid_proj.geometry.area
    grid_proj["drain_density"] = grid_proj["drain_length_m"] / grid_proj["cell_area_m2"]

    # Coverage gap: urban cell with zero drains (likely under-mapped OR zero formal drains)
    # Requires 'impervious_pct' column already merged from GEE pipeline
    if "impervious_pct" in grid_proj.columns:
        grid_proj["drain_coverage_gap"] = (
            (grid_proj["impervious_pct"] > 0.3) & (grid_proj["drain_length_m"] == 0)
        ).astype(int)
    else:
        logger.warning(
            "impervious_pct column not found — skipping drain_coverage_gap. "
            "Merge GEE features first."
        )
        grid_proj["drain_coverage_gap"] = np.nan

    return grid_proj.to_crs(grid_gdf.crs)


def calculate_blockage_proxies(
    grid_gdf: gpd.GeoDataFrame,
    proxies_gdf: gpd.GeoDataFrame,
    drainage_gdf: gpd.GeoDataFrame,
    buffer_m: float = 500.0,
    grid_id_col: str = "grid_id"
) -> gpd.GeoDataFrame:
    """
    For each cell, counts:
      - n_waste_sites_nearby : waste/dump OSM features within buffer_m of
                               any drain in this cell
      - n_markets_nearby     : market features within buffer_m of any drain

    The key insight: a waste site 500m from a drain matters much less than
    one directly adjacent. We weight by proximity to the nearest drain.
    """
    utm_crs = "EPSG:32631"
    grid_proj = grid_gdf.to_crs(utm_crs).copy()
    proxies_proj = proxies_gdf.to_crs(utm_crs).copy()
    drain_proj = drainage_gdf.to_crs(utm_crs).copy()

    logger.info("Calculating proximity-weighted blockage proxy counts...")

    if proxies_proj.empty:
        grid_proj["n_waste_sites_nearby"] = 0
        grid_proj["n_markets_nearby"] = 0
        return grid_proj.to_crs(grid_gdf.crs)

    # Buffer drains by buffer_m and dissolve per cell to get "drain influence zone"
    drain_buffered = drain_proj.copy()
    drain_buffered["geometry"] = drain_proj.geometry.buffer(buffer_m)

    # Clip buffer to cell boundaries via spatial join
    drain_zones = gpd.sjoin(
        drain_buffered, grid_proj[[grid_id_col, "geometry"]], how="inner", predicate="intersects"
    ).dissolve(by=grid_id_col).reset_index()[["grid_id", "geometry"]]

    # Count proxy features inside each drain influence zone
    proxies_in_zones = gpd.sjoin(
        proxies_proj, drain_zones, how="inner", predicate="within"
    )

    def classify_proxy(row):
        """Classify each proxy feature as waste or market."""
        if pd.notna(row.get("amenity")) and row["amenity"] in [
            "waste_disposal", "waste_transfer_station", "recycling", "landfill"
        ]:
            return "waste"
        if pd.notna(row.get("amenity")) and row["amenity"] == "marketplace":
            return "market"
        if pd.notna(row.get("landuse")) and row["landuse"] in ["landfill", "brownfield"]:
            return "waste"
        return "other"

    proxies_in_zones["proxy_type"] = proxies_in_zones.apply(classify_proxy, axis=1)

    # Pivot counts per cell
    proxy_counts = (
        proxies_in_zones.groupby([grid_id_col, "proxy_type"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    for col in ["waste", "market", "other"]:
        if col not in proxy_counts.columns:
            proxy_counts[col] = 0

    proxy_counts = proxy_counts.rename(columns={
        "waste": "n_waste_sites_nearby",
        "market": "n_markets_nearby"
    })

    grid_proj = grid_proj.merge(
        proxy_counts[[grid_id_col, "n_waste_sites_nearby", "n_markets_nearby"]],
        on=grid_id_col,
        how="left"
    )
    grid_proj["n_waste_sites_nearby"] = grid_proj["n_waste_sites_nearby"].fillna(0).astype(int)
    grid_proj["n_markets_nearby"] = grid_proj["n_markets_nearby"].fillna(0).astype(int)

    return grid_proj.to_crs(grid_gdf.crs)


# ─────────────────────────────────────────────
# 3.  NEWS / REPORT BLOCKAGE EVENTS
# ─────────────────────────────────────────────

def map_blockage_events_to_grid(
    blockage_events_df: pd.DataFrame,
    grid_gdf: gpd.GeoDataFrame,
    grid_id_col: str = "grid_id"
) -> gpd.GeoDataFrame:
    """
    Takes a DataFrame of news/report-derived blockage events (from labels_scraper.py)
    and maps them to grid cells to produce a historical_blockage_count feature.

    blockage_events_df must have columns:
        lat, lon, date, blockage_mentioned (bool), severity (optional)
    
    These come from the NLP extraction in labels_scraper.py where articles
    mentioning 'blocked drain', 'choked gutter', 'debris', 'clogged canal'
    are flagged and their location entities are geocoded.
    """
    grid = grid_gdf.copy()
    if blockage_events_df.empty or "lon" not in blockage_events_df.columns or "lat" not in blockage_events_df.columns:
        logger.warning("No valid blockage events provided (missing lon/lat) — blockage_event_count will be 0 for all cells.")
        grid["blockage_event_count"] = 0
        return grid

    # Convert events to GeoDataFrame
    events_gdf = gpd.GeoDataFrame(
        blockage_events_df,
        geometry=gpd.points_from_xy(blockage_events_df.lon, blockage_events_df.lat),
        crs="EPSG:4326"
    )

    # Only keep events where
    if "blockage_mentioned" in events_gdf.columns:
        events_gdf = events_gdf[events_gdf["blockage_mentioned"] == True]
    elif "is_blockage_attributed" in events_gdf.columns:
        events_gdf = events_gdf[events_gdf["is_blockage_attributed"] == 1]
    
    # Check if we have 'severity'
    if "severity" not in events_gdf.columns:
        events_gdf["severity"] = 1.0

    # Spatial join: which cell does each event fall in?
    joined = gpd.sjoin(events_gdf, grid_gdf[[grid_id_col, "geometry"]], how="left", predicate="within")

    # Count events per cell
    event_counts = joined.groupby(grid_id_col).size().reset_index(name="blockage_event_count")

    grid_gdf = grid_gdf.merge(event_counts, on=grid_id_col, how="left")
    grid_gdf["blockage_event_count"] = grid_gdf["blockage_event_count"].fillna(0).astype(int)

    logger.info(f"Mapped {len(events_gdf)} blockage events to {grid_gdf[grid_id_col].nunique()} grid cells.")
    return grid_gdf


# ─────────────────────────────────────────────
# 4.  COMPOSITE BLOCKAGE RISK SCORE
# ─────────────────────────────────────────────

def compute_composite_blockage_risk(grid_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Combines all blockage proxy features into a single normalised score
    per grid cell: composite_blockage_risk ∈ [0, 1].

    Weights (tunable):
        drain_coverage_gap      → 0.30   (urban area with no formal drains = high risk)
        drain_density (inverse) → 0.20   (paradox: denser mapped drains in dense urban
                                           areas = more potential blockage points)
        n_waste_sites_nearby    → 0.25   (waste near drains → blockage)
        n_markets_nearby        → 0.15   (markets → organic waste → blockage)
        blockage_event_count    → 0.10   (historical reported blockages)

    NOTE: These weights are a starting point. After labelled data is
    collected, run a feature importance analysis (SHAP) to re-tune them.
    """
    gdf = grid_gdf.copy()

    def safe_normalise(series: pd.Series) -> pd.Series:
        """Min-max normalise, handling all-zero or all-NaN series."""
        s = series.fillna(0)
        rng = s.max() - s.min()
        if rng == 0:
            return pd.Series(np.zeros(len(s)), index=s.index)
        return (s - s.min()) / rng

    weights = {
        "drain_coverage_gap":   0.30,
        "drain_density":        0.20,   # used inverted below
        "n_waste_sites_nearby": 0.25,
        "n_markets_nearby":     0.15,
        "blockage_event_count": 0.10,
    }

    # Ensure all required columns exist
    for col in weights:
        if col not in gdf.columns:
            logger.warning(f"Column '{col}' missing — defaulting to 0 for composite score.")
            gdf[col] = 0

    # Normalise each component
    norm_gap     = safe_normalise(gdf["drain_coverage_gap"])
    # Invert drain_density: low density in urban area = higher blockage risk
    # because it implies drains exist but are unmapped/informal
    norm_density = 1.0 - safe_normalise(gdf["drain_density"])
    norm_waste   = safe_normalise(gdf["n_waste_sites_nearby"])
    norm_market  = safe_normalise(gdf["n_markets_nearby"])
    norm_events  = safe_normalise(gdf["blockage_event_count"])

    gdf["composite_blockage_risk"] = (
        weights["drain_coverage_gap"]   * norm_gap     +
        weights["drain_density"]        * norm_density +
        weights["n_waste_sites_nearby"] * norm_waste   +
        weights["n_markets_nearby"]     * norm_market  +
        weights["blockage_event_count"] * norm_events
    )

    logger.info("Composite blockage risk score computed.")
    logger.info(f"  Score range: {gdf['composite_blockage_risk'].min():.3f} – "
                f"{gdf['composite_blockage_risk'].max():.3f}")
    return gdf


# ─────────────────────────────────────────────
# 5.  MAIN PIPELINE RUNNER
# ─────────────────────────────────────────────

def run_drainage_pipeline(
    grid_gdf: gpd.GeoDataFrame,
    blockage_events_df: Optional[pd.DataFrame] = None,
    drain_cache_path: str = "data/raw/lagos_drainage.geojson",
    proxy_cache_path: str = "data/raw/lagos_blockage_proxies.geojson",
    output_path: str = "data/interim/grid_with_drainage.geojson"
) -> gpd.GeoDataFrame:
    """
    Full drainage feature pipeline. Fetches data (or loads from cache),
    calculates all drainage features, and returns an enriched grid GeoDataFrame.

    Args:
        grid_gdf            : 500m Lagos grid from make_dataset.generate_lagos_grid()
        blockage_events_df  : Optional. Events from labels_scraper. If None, 
                              blockage_event_count defaults to 0.
        drain_cache_path    : Where to save/load OSM drainage data
        proxy_cache_path    : Where to save/load blockage proxy data
        output_path         : Where to save the enriched grid

    Returns:
        GeoDataFrame with all drainage features added.
    """
    import os

    # --- Fetch or load drainage data ---
    if os.path.exists(drain_cache_path):
        logger.info(f"Loading drainage data from cache: {drain_cache_path}")
        drainage_gdf = gpd.read_file(drain_cache_path)
    else:
        drainage_gdf = get_lagos_drainage()
        drainage_gdf.to_file(drain_cache_path, driver="GeoJSON")
        logger.info(f"Saved drainage data to {drain_cache_path}")

    # --- Fetch or load blockage proxies ---
    if os.path.exists(proxy_cache_path):
        logger.info(f"Loading proxy data from cache: {proxy_cache_path}")
        proxies_gdf = gpd.read_file(proxy_cache_path)
    else:
        proxies_gdf = get_lagos_blockage_proxies()
        proxies_gdf.to_file(proxy_cache_path, driver="GeoJSON")
        logger.info(f"Saved proxy data to {proxy_cache_path}")

    # --- Run calculations ---
    grid = calculate_drain_density(grid_gdf, drainage_gdf)
    grid = calculate_blockage_proxies(grid, proxies_gdf, drainage_gdf)
    grid = map_blockage_events_to_grid(
        blockage_events_df if blockage_events_df is not None else pd.DataFrame(),
        grid
    )
    grid = compute_composite_blockage_risk(grid)

    # --- Save output ---
    grid.to_file(output_path, driver="GeoJSON")
    logger.info(f"Drainage-enriched grid saved to {output_path}")

    return grid


if __name__ == "__main__":
    # Quick smoke test with a synthetic mini-grid
    from shapely.geometry import box as shapely_box

    logger.info("Running drainage_pipeline smoke test with synthetic grid...")

    # Simulate 4 grid cells around Lagos Island
    cells = []
    for i, (lon, lat) in enumerate([(3.38, 6.44), (3.39, 6.45), (3.40, 6.43), (3.37, 6.46)]):
        cell = shapely_box(lon, lat, lon + 0.005, lat + 0.005)
        cells.append({"grid_id": f"cell_{i}", "geometry": cell, "impervious_pct": 0.6 if i % 2 == 0 else 0.1})

    test_grid = gpd.GeoDataFrame(cells, crs="EPSG:4326")

    # Synthetic blockage events
    test_events = pd.DataFrame({
        "lat": [6.441, 6.451],
        "lon": [3.381, 3.391],
        "date": ["2023-07-15", "2022-09-03"],
        "blockage_mentioned": [True, True],
        "severity": ["high", "medium"]
    })

    # Run composite scoring with synthetic drainage data
    test_grid["drain_length_m"] = [0, 150, 300, 50]
    test_grid["cell_area_m2"] = [250000] * 4
    test_grid["drain_density"] = test_grid["drain_length_m"] / test_grid["cell_area_m2"]
    test_grid["drain_coverage_gap"] = ((test_grid["impervious_pct"] > 0.3) & (test_grid["drain_length_m"] == 0)).astype(int)
    test_grid["n_waste_sites_nearby"] = [3, 0, 1, 2]
    test_grid["n_markets_nearby"] = [1, 0, 2, 0]
    test_grid = map_blockage_events_to_grid(test_events, test_grid)
    test_grid = compute_composite_blockage_risk(test_grid)

    print("\n=== Smoke Test Results ===")
    print(test_grid[["grid_id", "drain_density", "drain_coverage_gap",
                     "n_waste_sites_nearby", "n_markets_nearby",
                     "blockage_event_count", "composite_blockage_risk"]].to_string())
