"""
make_dataset.py
---------------
Generates the 500m x 500m Lagos grid and merges all feature sources
into a single master dataset ready for modelling.

Pipeline order:
  1. generate_lagos_grid()     — create spatial grid over Lagos State
  2. merge_gee_features()      — attach rainfall, elevation, land use (from GEE exports)
  3. merge_osm_features()      — attach road density, dist_to_water (from osm_pipeline)
  4. merge_drainage_features() — attach blockage risk score (from drainage_pipeline)
  5. merge_labels()            — attach flood_risk_label (from DFO + scraper)
  6. save_master_dataset()     — write final Parquet + GeoJSON

Output schema (one row per grid_cell per date):
  grid_id | date | lat | lon |
  elevation_m | slope_deg | impervious_pct |
  rainfall_mm | rainfall_3d_sum | rainfall_7d_sum | is_rainy_season |
  road_density | dist_to_water_m |
  drain_density | drain_coverage_gap | n_waste_sites_nearby |
  n_markets_nearby | blockage_event_count | composite_blockage_risk |
  flood_risk_label  (0=Low, 1=Medium, 2=High, 3=Critical)
"""

import numpy as np
import pandas as pd
import geopandas as gpd
import logging
from shapely.geometry import box
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UTM_CRS   = "EPSG:32631"   # UTM Zone 31N — accurate metres for Lagos
WGS84_CRS = "EPSG:4326"


# ─────────────────────────────────────────────────────────
# 1. GRID GENERATION
# ─────────────────────────────────────────────────────────

def generate_lagos_grid(
    lagos_boundary_gdf: gpd.GeoDataFrame = None,
    cell_size_m: int = 500
) -> gpd.GeoDataFrame:
    """
    Generates a 500m x 500m grid over Lagos State.

    If lagos_boundary_gdf is None, uses a hardcoded bounding box for
    Lagos State so the pipeline can run without a shapefile.

    Returns a GeoDataFrame (CRS: EPSG:4326) with columns:
        grid_id, geometry, centroid_lat, centroid_lon
    """
    logger.info(f"Generating {cell_size_m}m grid over Lagos State...")

    if lagos_boundary_gdf is not None:
        boundary = lagos_boundary_gdf.to_crs(UTM_CRS).union_all()
    else:
        # Lagos State bounding box (WGS84) → project to UTM for grid generation
        lagos_bbox_wgs84 = box(2.7, 6.35, 4.0, 6.7)
        boundary_gdf = gpd.GeoDataFrame(geometry=[lagos_bbox_wgs84], crs=WGS84_CRS)
        boundary = boundary_gdf.to_crs(UTM_CRS).union_all()

    minx, miny, maxx, maxy = boundary.bounds

    cols = int(np.ceil((maxx - minx) / cell_size_m))
    rows = int(np.ceil((maxy - miny) / cell_size_m))
    logger.info(f"  Grid dimensions: {cols} cols × {rows} rows = {cols*rows:,} cells (before clipping)")

    cells = []
    cell_id = 0
    for row in range(rows):
        for col in range(cols):
            x0 = minx + col * cell_size_m
            y0 = miny + row * cell_size_m
            x1 = x0 + cell_size_m
            y1 = y0 + cell_size_m
            cell_geom = box(x0, y0, x1, y1)
            if boundary.intersects(cell_geom):
                cells.append({
                    "grid_id": f"NG-LA-{cell_id:06d}",
                    "geometry": cell_geom,
                })
                cell_id += 1

    grid = gpd.GeoDataFrame(cells, crs=UTM_CRS).to_crs(WGS84_CRS)

    # Add centroid coordinates for easy lat/lon lookup
    centroids = grid.geometry.centroid
    grid["centroid_lat"] = centroids.y
    grid["centroid_lon"] = centroids.x

    logger.info(f"  Final grid: {len(grid):,} cells after clipping to Lagos boundary.")
    return grid


# ─────────────────────────────────────────────────────────
# 2. MERGE GEE FEATURES
# ─────────────────────────────────────────────────────────

def merge_gee_features(
    grid_gdf: gpd.GeoDataFrame,
    static_raster_path: str = "data/raw/lagos_static_features_500m.tif",
    chirps_dir: str = "data/raw/chirps/"
) -> gpd.GeoDataFrame:
    """
    Merges GEE-exported raster features into the grid.

    GEE exports (from gee_pipeline.py) land in Google Drive as GeoTIFFs.
    Download them into data/raw/ before running this.

    Static features (elevation, slope, impervious):
        Sampled at each grid cell centroid.

    Rainfall (CHIRPS daily):
        Aggregated per cell per day → produces a long-format temporal table.
        Saved separately to data/interim/rainfall_long.parquet

    If rasters are not yet downloaded, returns grid with NaN feature columns
    and logs a clear warning so the pipeline doesn't crash.
    """
    import os
    grid = grid_gdf.copy()

    # ── Static features ──────────────────────────────────
    if os.path.exists(static_raster_path):
        try:
            import rasterio
            from rasterio.sample import sample_gen

            coords = [(row.centroid_lon, row.centroid_lat) for _, row in grid.iterrows()]
            with rasterio.open(static_raster_path) as src:
                # Band order from gee_pipeline: elevation, slope, impervious
                samples = list(sample_gen(src, coords))
            values = np.array(samples)
            grid["elevation_m"]     = values[:, 0]
            grid["slope_deg"]       = values[:, 1]
            grid["impervious_pct"]  = values[:, 2]
            logger.info("Static GEE features merged (elevation, slope, impervious_pct).")
        except Exception as e:
            logger.warning(f"Could not read static raster: {e}. Columns set to NaN.")
            for col in ["elevation_m", "slope_deg", "impervious_pct"]:
                grid[col] = np.nan
    else:
        logger.warning(
            f"Static raster not found at '{static_raster_path}'. "
            "Run gee_pipeline.export_static_features_to_drive() and download from Drive first."
        )
        for col in ["elevation_m", "slope_deg", "impervious_pct"]:
            grid[col] = np.nan

    return grid


def build_rainfall_timeseries(
    grid_gdf: gpd.GeoDataFrame,
    chirps_dir: str = "data/raw/chirps/",
    output_path: str = "data/interim/rainfall_long.parquet"
) -> pd.DataFrame:
    """
    Reads yearly CHIRPS GeoTIFF exports and produces a long-format DataFrame:
        grid_id | date | rainfall_mm

    Saves to Parquet for efficient loading during model training.
    This is separate from merge_gee_features() because rainfall is temporal
    (one row per cell per day) while static features are one row per cell.
    """
    import os, glob
    import rasterio
    from rasterio.sample import sample_gen

    tif_files = sorted(glob.glob(f"{chirps_dir}/*.tif"))
    if not tif_files:
        logger.warning(
            f"No CHIRPS TIF files found in '{chirps_dir}'. "
            "Download GEE exports from Google Drive first."
        )
        return pd.DataFrame(columns=["grid_id", "date", "rainfall_mm"])

    coords = [(row.centroid_lon, row.centroid_lat) for _, row in grid_gdf.iterrows()]
    grid_ids = grid_gdf["grid_id"].values
    dfs = []

    for tif_path in tif_files:
        year = os.path.basename(tif_path).split("_")[-1].replace(".tif", "")
        logger.info(f"  Processing CHIRPS {year}...")
        with rasterio.open(tif_path) as src:
            band_names = list(src.descriptions)   # e.g. "2015_06_15"
            
            # Super-fast in-memory extraction
            data = src.read() # shape (n_bands, rows, cols)
            row_idx, col_idx = zip(*[src.index(lon, lat) for lon, lat in coords])
            # Ensure indices are within bounds
            row_idx = np.clip(row_idx, 0, data.shape[1] - 1)
            col_idx = np.clip(col_idx, 0, data.shape[2] - 1)
            
            samples = data[:, row_idx, col_idx].T  # shape (n_cells, n_days)
            
            # Vectorized reshape using Pandas melt
            year_df = pd.DataFrame(samples, columns=band_names)
            year_df["grid_id"] = grid_ids
            year_df_long = year_df.melt(id_vars="grid_id", var_name="date_str", value_name="rainfall_mm")
            # band names are like '20210101_2021_01_01', extract the last 10 chars
            year_df_long["date_str"] = year_df_long["date_str"].str[-10:]
            year_df_long["date"] = pd.to_datetime(year_df_long["date_str"], format="%Y_%m_%d", errors="coerce")
            year_df_long = year_df_long.dropna(subset=["date"]).drop(columns=["date_str"])
            dfs.append(year_df_long)

    df = pd.concat(dfs, ignore_index=True)
    df.to_parquet(output_path, index=False)
    logger.info(f"Rainfall timeseries saved to {output_path} ({len(df):,} rows).")
    return df


# ─────────────────────────────────────────────────────────
# 3. MERGE OSM FEATURES
# ─────────────────────────────────────────────────────────

def merge_osm_features(
    grid_gdf: gpd.GeoDataFrame,
    roads_path: str = "data/raw/lagos_roads.geojson",
    waterways_path: str = "data/raw/lagos_waterways.geojson"
) -> gpd.GeoDataFrame:
    """
    Calls osm_pipeline.calculate_osm_features_for_grid() if raw OSM data
    is available, otherwise returns grid with NaN columns.
    """
    import os
    grid = grid_gdf.copy()

    if os.path.exists(roads_path) and os.path.exists(waterways_path):
        from src.data.osm_pipeline import calculate_osm_features_for_grid
        roads_gdf     = gpd.read_file(roads_path)
        waterways_gdf = gpd.read_file(waterways_path)
        grid = calculate_osm_features_for_grid(grid, roads_gdf, waterways_gdf)
        logger.info("OSM features merged (road_density, dist_to_water_m).")
    else:
        logger.warning(
            "OSM data not found. Run osm_pipeline and save to data/raw/ first."
        )
        grid["road_density"]    = np.nan
        grid["dist_to_water_m"] = np.nan

    return grid


# ─────────────────────────────────────────────────────────
# 4. MERGE DRAINAGE FEATURES
# ─────────────────────────────────────────────────────────

def merge_drainage_features(
    grid_gdf: gpd.GeoDataFrame,
    drain_cache: str = "data/raw/lagos_drainage.geojson",
    proxy_cache: str = "data/raw/lagos_blockage_proxies.geojson",
    blockage_events_path: str = "data/raw/lagos_news_floods.csv"
) -> gpd.GeoDataFrame:
    """
    Runs drainage_pipeline.run_drainage_pipeline() to attach all
    blockage-related features to the grid.
    """
    import os
    from src.data.drainage_pipeline import run_drainage_pipeline

    blockage_events = None
    if os.path.exists(blockage_events_path):
        blockage_events = pd.read_csv(blockage_events_path)
        logger.info(f"Loaded {len(blockage_events)} blockage events from {blockage_events_path}")

    grid = run_drainage_pipeline(
        grid_gdf=grid_gdf,
        blockage_events_df=blockage_events,
        drain_cache_path=drain_cache,
        proxy_cache_path=proxy_cache,
        output_path="data/interim/grid_with_drainage.geojson"
    )
    logger.info("Drainage features merged.")
    return grid


# ─────────────────────────────────────────────────────────
# 5. MERGE LABELS
# ─────────────────────────────────────────────────────────

def assign_flood_risk_labels(
    grid_gdf: gpd.GeoDataFrame,
    dfo_path: str = "data/raw/dfo_nigeria_floods.csv",
    local_events_path: str = "data/raw/lagos_news_floods.csv"
) -> gpd.GeoDataFrame:
    """
    Creates flood_event_count per grid cell from DFO and local sources,
    then bins into risk classes:
        0 = Low      (0 recorded flood events)
        1 = Medium   (1–2 events)
        2 = High     (3–5 events)
        3 = Critical (6+ events)

    DFO CSV format (download from: https://floodobservatory.colorado.edu/Archives.html):
        ID, GlideNumber, Country, OtherCountry, long, lat, Area, Began, Ended,
        Validation, Dead, Displaced, MainCause, Severity

    Note: DFO tracks large events only. Local news/LASEMA events supplement this.
    """
    import os

    grid = grid_gdf.copy()
    grid["flood_event_count"] = 0

    # ── DFO events ───────────────────────────────────────
    if os.path.exists(dfo_path):
        dfo = pd.read_csv(dfo_path)
        dfo = dfo[dfo["Country"].str.contains("Nigeria", na=False)].copy()
        dfo_gdf = gpd.GeoDataFrame(
            dfo,
            geometry=gpd.points_from_xy(dfo["long"], dfo["lat"]),
            crs=WGS84_CRS
        )
        joined = gpd.sjoin(dfo_gdf, grid[["grid_id", "geometry"]], how="left", predicate="within")
        counts = joined.groupby("grid_id").size().reset_index(name="dfo_count")
        grid = grid.merge(counts, on="grid_id", how="left")
        grid["dfo_count"] = grid["dfo_count"].fillna(0)
        grid["flood_event_count"] += grid["dfo_count"]
        logger.info(f"DFO: {len(dfo)} Nigeria events mapped to grid.")
    else:
        logger.warning(f"DFO file not found at '{dfo_path}'. Download from floodobservatory.colorado.edu")
        grid["dfo_count"] = 0

    # ── Local news / LASEMA events ───────────────────────
    if os.path.exists(local_events_path):
        local = pd.read_csv(local_events_path)
        if "lon" in local.columns and "lat" in local.columns:
            local_gdf = gpd.GeoDataFrame(
                local,
                geometry=gpd.points_from_xy(local["lon"], local["lat"]),
                crs=WGS84_CRS
            )
            joined_local = gpd.sjoin(local_gdf, grid[["grid_id", "geometry"]], how="left", predicate="within")
            local_counts = joined_local.groupby("grid_id").size().reset_index(name="local_count")
            grid = grid.merge(local_counts, on="grid_id", how="left")
            grid["local_count"] = grid["local_count"].fillna(0)
            grid["flood_event_count"] += grid["local_count"]
            logger.info(f"Local events: {len(local)} events mapped to grid.")
        else:
            logger.warning("Local events CSV is missing 'lon' and 'lat'. Skipping spatial mapping of local news events.")
            grid["local_count"] = 0
    else:
        grid["local_count"] = 0

    # ── Temporal binning now happens in build_master_dataset ──────
    
    return grid


# ─────────────────────────────────────────────────────────
# 6. BUILD MASTER DATASET (static + temporal join)
# ─────────────────────────────────────────────────────────

def build_master_dataset(
    grid_gdf: gpd.GeoDataFrame,
    rainfall_parquet: str = "data/interim/rainfall_long.parquet",
    output_dir: str = "data/processed/"
) -> pd.DataFrame:
    """
    Joins the static grid features with the temporal rainfall data to produce
    the final model-ready dataset.

    Static features (one row per cell):
        grid_id, elevation_m, slope_deg, impervious_pct, road_density,
        dist_to_water_m, drain_density, composite_blockage_risk, flood_risk_label, ...

    Temporal features (one row per cell per day):
        rainfall_mm, rainfall_3d_sum, rainfall_7d_sum, is_rainy_season

    Output: one row per (grid_id, date), all features present.
    Saved as: data/processed/master_dataset.parquet
    """
    import os
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    static_cols = [
        "grid_id", "centroid_lat", "centroid_lon",
        "elevation_m", "slope_deg", "impervious_pct",
        "road_density", "dist_to_water_m",
        "drain_density", "drain_coverage_gap",
        "n_waste_sites_nearby", "n_markets_nearby",
        "blockage_event_count", "composite_blockage_risk"
    ]
    # Keep only columns that actually exist
    available_static = [c for c in static_cols if c in grid_gdf.columns]
    static_df = pd.DataFrame(grid_gdf[available_static])

    if not os.path.exists(rainfall_parquet):
        logger.warning(
            f"Rainfall parquet not found at '{rainfall_parquet}'. "
            "Returning static-only dataset (no temporal features)."
        )
        static_df.to_parquet(f"{output_dir}/master_dataset_static.parquet", index=False)
        return static_df

    logger.info("Loading rainfall timeseries...")
    rain_df = pd.read_parquet(rainfall_parquet)

    logger.info("Computing rolling rainfall sums...")
    rain_df.sort_values(["grid_id", "date"], inplace=True)
    rain_df["rainfall_3d_sum"] = rain_df["rainfall_mm"].rolling(3, min_periods=1).sum()
    rain_df["rainfall_7d_sum"] = rain_df["rainfall_mm"].rolling(7, min_periods=1).sum()

    # Lagos rainy season: April (4) – October (10)
    rain_df["date"] = pd.to_datetime(rain_df["date"])
    rain_df["is_rainy_season"] = rain_df["date"].dt.month.between(4, 10).astype(int)
    rain_df["month"] = rain_df["date"].dt.month
    rain_df["year"]  = rain_df["date"].dt.year

    # Join static + temporal
    master = rain_df.merge(static_df, on="grid_id", how="left")

    # ── Temporal Labeling ──────────────────────────────────
    master["flood_risk_label"] = 0
    
    # 1. Local News (+/- 3 days window)
    local_path = "data/raw/lagos_news_floods.csv"
    if os.path.exists(local_path):
        local = pd.read_csv(local_path)
        if "lon" in local.columns and "date" in local.columns:
            local = local.dropna(subset=["lon", "date"])
            local_gdf = gpd.GeoDataFrame(local, geometry=gpd.points_from_xy(local["lon"], local["lat"]), crs=grid_gdf.crs)
            joined_local = gpd.sjoin(local_gdf, grid_gdf[["grid_id", "geometry"]], how="inner", predicate="within")
            for _, row in joined_local.iterrows():
                grid_id = row["grid_id"]
                d = pd.to_datetime(row["date"])
                mask = (master["grid_id"] == grid_id) & (master["date"] >= d - pd.Timedelta(days=3)) & (master["date"] <= d + pd.Timedelta(days=3))
                master.loc[mask, "flood_risk_label"] = 1
                
    # 2. DFO (start to end date)
    dfo_path = "data/raw/dfo_nigeria_floods.csv"
    if os.path.exists(dfo_path):
        dfo = pd.read_csv(dfo_path)
        dfo = dfo[dfo["Country"].str.contains("Nigeria", na=False)].copy()
        dfo = dfo.dropna(subset=["long", "lat", "Began", "Ended"])
        dfo_gdf = gpd.GeoDataFrame(dfo, geometry=gpd.points_from_xy(dfo["long"], dfo["lat"]), crs=grid_gdf.crs)
        joined_dfo = gpd.sjoin(dfo_gdf, grid_gdf[["grid_id", "geometry"]], how="inner", predicate="within")
        for _, row in joined_dfo.iterrows():
            grid_id = row["grid_id"]
            start_d = pd.to_datetime(row["Began"], errors='coerce')
            end_d = pd.to_datetime(row["Ended"], errors='coerce')
            if pd.isna(start_d) or pd.isna(end_d): continue
            mask = (master["grid_id"] == grid_id) & (master["date"] >= start_d) & (master["date"] <= end_d)
            master.loc[mask, "flood_risk_label"] = 2

    out_path = f"{output_dir}/master_dataset.parquet"
    master.to_parquet(out_path, index=False)
    logger.info(f"Master dataset saved: {out_path}")
    logger.info(f"  Shape: {master.shape[0]:,} rows × {master.shape[1]} columns")
    logger.info(f"  Date range: {master['date'].min()} → {master['date'].max()}")
    logger.info(f"  Grid cells: {master['grid_id'].nunique():,}")
    logger.info(f"  Label dist:\n{master['flood_risk_label'].value_counts()}")
    return master


# ─────────────────────────────────────────────────────────
# 7. FULL PIPELINE RUNNER
# ─────────────────────────────────────────────────────────

def run_full_pipeline(
    lagos_boundary_path: str = None,
    cell_size_m: int = 500
) -> gpd.GeoDataFrame:
    """
    Runs the complete data preparation pipeline end-to-end.
    Call this from a notebook or CLI after all raw data is downloaded.

    Returns the enriched grid GeoDataFrame (static features).
    Call build_master_dataset() separately to join with temporal rainfall.
    """
    # 1. Grid
    boundary = gpd.read_file(lagos_boundary_path) if lagos_boundary_path else None
    grid = generate_lagos_grid(boundary, cell_size_m)

    # 2. GEE static features
    grid = merge_gee_features(grid)

    # 3. OSM features
    grid = merge_osm_features(grid)

    # 4. Drainage / blockage features
    grid = merge_drainage_features(grid)

    # 5. Labels
    grid = assign_flood_risk_labels(grid)

    # Save enriched grid
    Path("data/interim").mkdir(parents=True, exist_ok=True)
    grid.to_file("data/interim/grid_enriched.geojson", driver="GeoJSON")
    logger.info("Enriched grid saved to data/interim/grid_enriched.geojson")

    return grid


# ─────────────────────────────────────────────────────────
# SMOKE TEST
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=== make_dataset smoke test ===")
    grid = generate_lagos_grid(cell_size_m=500)
    print(f"Grid shape: {grid.shape}")
    print(f"Sample cells:\n{grid[['grid_id','centroid_lat','centroid_lon']].head()}")
    print(f"Bounds: {grid.total_bounds}")
