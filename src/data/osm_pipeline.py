import osmnx as ox
import pandas as pd
import geopandas as gpd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_lagos_roads():
    """
    Fetch road network for Lagos State from OpenStreetMap.
    'drive' network type captures main roads and streets.
    """
    logger.info("Fetching road network for Lagos. This might take a few minutes...")
    G = ox.graph_from_place('Lagos State, Nigeria', network_type='drive')
    nodes, edges = ox.graph_to_gdfs(G)
    logger.info(f"Retrieved {len(edges)} road segments.")
    return edges

def get_lagos_waterways():
    """
    Fetch waterways and drainage networks for Lagos State.
    """
    logger.info("Fetching waterways for Lagos...")
    tags = {'waterway': True, 'natural': 'water'}
    waterways = ox.features_from_place('Lagos State, Nigeria', tags=tags)
    logger.info(f"Retrieved {len(waterways)} waterway/drainage features.")
    return waterways

def calculate_osm_features_for_grid(grid_gdf, roads_gdf, waterways_gdf):
    """
    Calculates road density and distance to nearest waterway for each grid cell.
    grid_gdf should be a GeoDataFrame of 500x500m polygons.
    """
    # Use UTM Zone 31N for Lagos for accurate distance calculations in meters
    utm_crs = 'EPSG:32631' 
    grid_proj = grid_gdf.to_crs(utm_crs)
    roads_proj = roads_gdf.to_crs(utm_crs)
    waterways_proj = waterways_gdf.to_crs(utm_crs)
    
    # 1. Distance to nearest waterway
    logger.info("Calculating distance to waterways...")
    # Get centroids of the grid cells
    centroids = grid_proj.copy()
    centroids.geometry = centroids.geometry.centroid
    
    # Find the nearest waterway feature to each centroid
    # (Requires geopandas >= 0.10.0 and shapely >= 2.0 / pygeos)
    nearest = gpd.sjoin_nearest(
        centroids, 
        waterways_proj, 
        how='left', 
        distance_col='dist_to_water'
    )
    
    # Merge distance back to the original grid (handling potential duplicates if equidistant)
    nearest = nearest[~nearest.index.duplicated(keep='first')]
    grid_proj['dist_to_water_m'] = nearest['dist_to_water']
    
    # 2. Road Density (length of roads in meters per cell area)
    logger.info("Calculating road density...")
    # Intersect roads with grid cells to calculate exact road length inside each cell
    roads_intersected = gpd.overlay(roads_proj, grid_proj[['grid_id', 'geometry']], how='intersection')
    roads_intersected['road_length_m'] = roads_intersected.geometry.length
    
    # Sum the lengths per grid cell
    road_lengths = roads_intersected.groupby('grid_id')['road_length_m'].sum().reset_index()
    
    # Merge back to grid
    grid_proj = grid_proj.merge(road_lengths, on='grid_id', how='left')
    grid_proj['road_length_m'] = grid_proj['road_length_m'].fillna(0)
    grid_proj['road_density'] = grid_proj['road_length_m'] / grid_proj.geometry.area
    
    return grid_proj.to_crs(grid_gdf.crs)

if __name__ == "__main__":
    roads = get_lagos_roads()
    waterways = get_lagos_waterways()
    
    roads.to_file("data/raw/lagos_roads.geojson", driver="GeoJSON")
    waterways.to_file("data/raw/lagos_waterways.geojson", driver="GeoJSON")
    logger.info("Saved roads and waterways to data/raw/")
