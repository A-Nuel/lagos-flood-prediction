import pandas as pd
import geopandas as gpd
import os

print("Loading grid...")
grid = gpd.read_file("data/interim/grid_enriched.geojson")

print("Loading master dataset...")
master = pd.read_parquet("data/processed/master_dataset.parquet")
master["flood_risk_label"] = 0 # reset labels
master["date"] = pd.to_datetime(master["date"])

# 1. Local News
local_path = "data/raw/lagos_news_floods.csv"
if os.path.exists(local_path):
    local = pd.read_csv(local_path)
    if "lon" in local.columns and "date" in local.columns:
        local = local.dropna(subset=["lon", "date"])
        local_gdf = gpd.GeoDataFrame(
            local, 
            geometry=gpd.points_from_xy(local["lon"], local["lat"]),
            crs=grid.crs
        )
        joined_local = gpd.sjoin(local_gdf, grid[["grid_id", "geometry"]], how="inner", predicate="within")
        
        for _, row in joined_local.iterrows():
            grid_id = row["grid_id"]
            d = pd.to_datetime(row["date"])
            # +/- 3 days window
            mask = (master["grid_id"] == grid_id) & (master["date"] >= d - pd.Timedelta(days=3)) & (master["date"] <= d + pd.Timedelta(days=3))
            master.loc[mask, "flood_risk_label"] = 1
            print(f"Set {mask.sum()} rows to Medium risk (Label 1) for {grid_id} around {d.date()}")

# 2. DFO
dfo_path = "data/raw/dfo_nigeria_floods.csv"
if os.path.exists(dfo_path):
    dfo = pd.read_csv(dfo_path)
    dfo = dfo[dfo["Country"].str.contains("Nigeria", na=False)].copy()
    dfo = dfo.dropna(subset=["long", "lat", "Began", "Ended"])
    dfo_gdf = gpd.GeoDataFrame(
        dfo,
        geometry=gpd.points_from_xy(dfo["long"], dfo["lat"]),
        crs=grid.crs
    )
    joined_dfo = gpd.sjoin(dfo_gdf, grid[["grid_id", "geometry"]], how="inner", predicate="within")
    
    for _, row in joined_dfo.iterrows():
        grid_id = row["grid_id"]
        start_d = pd.to_datetime(row["Began"], errors='coerce')
        end_d = pd.to_datetime(row["Ended"], errors='coerce')
        if pd.isna(start_d) or pd.isna(end_d): continue
        
        mask = (master["grid_id"] == grid_id) & (master["date"] >= start_d) & (master["date"] <= end_d)
        master.loc[mask, "flood_risk_label"] = 2
        print(f"Set {mask.sum()} rows to High risk (Label 2) for {grid_id} from {start_d.date()} to {end_d.date()}")

print("Distribution:")
print(master["flood_risk_label"].value_counts())
pos_cells = master[master["flood_risk_label"] > 0]["grid_id"].nunique()
print("Unique positive cells:", pos_cells)

print("Saving...")
master.to_parquet("data/processed/master_dataset.parquet", index=False)
print("Done!")
