import duckdb
import pandas as pd
import geopandas as gpd
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fast_build_master(
    rainfall_parquet="data/interim/rainfall_long.parquet",
    grid_geojson="data/interim/grid_enriched.geojson",
    news_csv="data/raw/lagos_news_floods.csv",
    dfo_csv="data/raw/dfo_nigeria_floods.csv",
    out_parquet="data/processed/master_dataset.parquet"
):
    Path("data/processed").mkdir(parents=True, exist_ok=True)
    
    # Remove existing temp duckdb file if any to start fresh
    temp_db = 'data/interim/temp.duckdb'
    if os.path.exists(temp_db):
        try:
            os.remove(temp_db)
        except Exception:
            pass
            
    logger.info("Connecting to DuckDB...")
    con = duckdb.connect(database=temp_db)
    con.execute("PRAGMA threads=4;")
    con.execute("PRAGMA memory_limit='6GB';")
    
    logger.info("Computing rolling rainfall sums directly from parquet...")
    con.execute(f"""
        CREATE OR REPLACE TABLE rainfall_rolled AS 
        SELECT *, 
            SUM(rainfall_mm) OVER (PARTITION BY grid_id ORDER BY date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS rainfall_3d_sum,
            SUM(rainfall_mm) OVER (PARTITION BY grid_id ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rainfall_7d_sum,
            CASE WHEN EXTRACT(MONTH FROM date) BETWEEN 4 AND 10 THEN 1 ELSE 0 END AS is_rainy_season,
            EXTRACT(MONTH FROM date) AS month,
            EXTRACT(YEAR FROM date) AS year
        FROM read_parquet('{rainfall_parquet}')
    """)
    
    # Load static features
    logger.info(f"Loading static features from {grid_geojson}...")
    static_gdf = gpd.read_file(grid_geojson)
    static_cols = [
        "grid_id", "centroid_lat", "centroid_lon",
        "elevation_m", "slope_deg", "impervious_pct",
        "road_density", "dist_to_water_m",
        "drain_density", "drain_coverage_gap",
        "n_waste_sites_nearby", "n_markets_nearby",
        "blockage_event_count", "composite_blockage_risk"
    ]
    available_static = [c for c in static_cols if c in static_gdf.columns]
    static_df = pd.DataFrame(static_gdf[available_static])
    con.register('static_df', static_df)
    
    # Build event intervals for lightning-fast join
    logger.info("Assembling flood event intervals...")
    event_rows = []
    
    # 1. Local News events (label = 1, +/- 3 days)
    if os.path.exists(news_csv):
        local = pd.read_csv(news_csv)
        if "lon" in local.columns and "lat" in local.columns and "date" in local.columns:
            local = local.dropna(subset=["lon", "lat", "date"])
            local_gdf = gpd.GeoDataFrame(local, geometry=gpd.points_from_xy(local["lon"], local["lat"]), crs=static_gdf.crs)
            joined_local = gpd.sjoin(local_gdf, static_gdf[["grid_id", "geometry"]], how="inner", predicate="within")
            for _, row in joined_local.iterrows():
                try:
                    d = pd.to_datetime(row["date"])
                    start_d = (d - pd.Timedelta(days=3)).strftime("%Y-%m-%d")
                    end_d = (d + pd.Timedelta(days=3)).strftime("%Y-%m-%d")
                    event_rows.append({
                        "grid_id": row["grid_id"],
                        "start_date": start_d,
                        "end_date": end_d,
                        "label": 1
                    })
                except Exception:
                    continue
            logger.info(f"Loaded {len(joined_local)} local news event spatial intersections.")
            
    # 2. DFO events (label = 2, Began to Ended)
    if os.path.exists(dfo_csv):
        dfo = pd.read_csv(dfo_csv)
        dfo = dfo[dfo["Country"].str.contains("Nigeria", na=False)].copy()
        dfo = dfo.dropna(subset=["long", "lat", "Began", "Ended"])
        dfo_gdf = gpd.GeoDataFrame(dfo, geometry=gpd.points_from_xy(dfo["long"], dfo["lat"]), crs=static_gdf.crs)
        joined_dfo = gpd.sjoin(dfo_gdf, static_gdf[["grid_id", "geometry"]], how="inner", predicate="within")
        for _, row in joined_dfo.iterrows():
            try:
                start_d = pd.to_datetime(row["Began"], errors='coerce')
                end_d = pd.to_datetime(row["Ended"], errors='coerce')
                if pd.isna(start_d) or pd.isna(end_d):
                    continue
                event_rows.append({
                    "grid_id": row["grid_id"],
                    "start_date": start_d.strftime("%Y-%m-%d"),
                    "end_date": end_d.strftime("%Y-%m-%d"),
                    "label": 2
                })
            except Exception:
                continue
        logger.info(f"Loaded {len(joined_dfo)} DFO event spatial intersections.")
        
    events_df = pd.DataFrame(event_rows) if event_rows else pd.DataFrame(columns=["grid_id", "start_date", "end_date", "label"])
    con.register('events_df', events_df)
    
    logger.info("Joining temporal, static features, and event labels in DuckDB...")
    con.execute("""
        CREATE OR REPLACE TABLE master AS 
        SELECT 
            r.*, 
            s.* EXCLUDE (grid_id),
            COALESCE(e.max_label, 0) AS flood_risk_label
        FROM rainfall_rolled r
        LEFT JOIN static_df s ON r.grid_id = s.grid_id
        LEFT JOIN (
            SELECT 
                r_inner.grid_id, 
                r_inner.date, 
                MAX(ev.label) AS max_label
            FROM rainfall_rolled r_inner
            JOIN events_df ev 
                ON r_inner.grid_id = ev.grid_id 
                AND r_inner.date >= ev.start_date::DATE 
                AND r_inner.date <= ev.end_date::DATE
            GROUP BY r_inner.grid_id, r_inner.date
        ) e ON r.grid_id = e.grid_id AND r.date = e.date
    """)
    
    logger.info(f"Exporting master dataset directly to {out_parquet}...")
    con.execute(f"COPY master TO '{out_parquet}' (FORMAT PARQUET, COMPRESSION 'ZSTD')")
    
    logger.info("Querying dataset verification metrics directly from DuckDB...")
    stats = con.execute("""
        SELECT 
            COUNT(*) AS total_rows,
            COUNT(DISTINCT grid_id) AS total_grids,
            SUM(CASE WHEN flood_risk_label > 0 THEN 1 ELSE 0 END) AS total_positives,
            COUNT(DISTINCT CASE WHEN flood_risk_label > 0 THEN grid_id END) AS pos_unique_grids,
            COUNT(DISTINCT CASE WHEN flood_risk_label = 1 THEN grid_id END) AS label1_unique_grids,
            COUNT(DISTINCT CASE WHEN flood_risk_label = 2 THEN grid_id END) AS label2_unique_grids,
            SUM(CASE WHEN flood_risk_label = 0 THEN 1 ELSE 0 END) AS count_class_0,
            SUM(CASE WHEN flood_risk_label = 1 THEN 1 ELSE 0 END) AS count_class_1,
            SUM(CASE WHEN flood_risk_label = 2 THEN 1 ELSE 0 END) AS count_class_2
        FROM master
    """).df()
    
    print("\n" + "="*50)
    print("      MASTER DATASET SUMMARY METRICS")
    print("="*50)
    print(stats.to_string(index=False))
    print("="*50 + "\n")
    
    con.close()
    logger.info("Done!")

if __name__ == "__main__":
    fast_build_master()
