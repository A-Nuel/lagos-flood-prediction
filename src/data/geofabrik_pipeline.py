import os
import requests
import zipfile
import logging
import geopandas as gpd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_and_extract_nigeria_osm():
    url = "https://download.geofabrik.de/africa/nigeria-latest-free.shp.zip"
    zip_path = "data/raw/nigeria-latest-free.shp.zip"
    extract_dir = "data/raw/nigeria_osm_shp"

    if not os.path.exists(zip_path):
        logger.info(f"Downloading Nigeria OSM shapefiles from {url}...")
        resp = requests.get(url, stream=True)
        resp.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("Download complete.")

    if not os.path.exists(extract_dir):
        logger.info(f"Extracting to {extract_dir}...")
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        logger.info("Extraction complete.")

    return extract_dir

def cache_lagos_osm_data(lagos_boundary_path="data/raw/lagos_boundary.geojson"):
    extract_dir = download_and_extract_nigeria_osm()
    
    logger.info("Loading Lagos boundary...")
    boundary = gpd.read_file(lagos_boundary_path)
    
    # Roads
    logger.info("Processing roads...")
    roads = gpd.read_file(f"{extract_dir}/gis_osm_roads_free_1.shp")
    lagos_roads = gpd.clip(roads, boundary)
    lagos_roads.to_file("data/raw/lagos_roads.geojson", driver="GeoJSON")
    logger.info(f"Saved {len(lagos_roads)} roads to data/raw/lagos_roads.geojson")
    
    # Waterways
    logger.info("Processing waterways...")
    waterways = gpd.read_file(f"{extract_dir}/gis_osm_waterways_free_1.shp")
    lagos_waterways = gpd.clip(waterways, boundary)
    lagos_waterways.to_file("data/raw/lagos_waterways.geojson", driver="GeoJSON")
    logger.info(f"Saved {len(lagos_waterways)} waterways to data/raw/lagos_waterways.geojson")

if __name__ == "__main__":
    cache_lagos_osm_data()
