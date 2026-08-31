import geopandas as gpd
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_dfo_nigeria():
    shp_path = "data/raw/MODIS_GlobalFloodDatabase/data/shp_files/dfo_polys_20191203.shp"
    output_csv = "data/raw/dfo_nigeria_floods.csv"
    
    logger.info(f"Loading DFO shapefile from {shp_path}...")
    try:
        # Load the shapefile
        gdf = gpd.read_file(shp_path)
    except Exception as e:
        logger.error(f"Failed to read shapefile: {e}")
        return

    # Filter by Country. DFO polys might use 'COUNTRY' or 'Country' or 'Admin0'.
    # Let's check columns
    logger.info(f"Available columns: {gdf.columns.tolist()}")
    
    country_col = None
    for col in ["COUNTRY", "Country", "Admin0", "ADMIN0", "country"]:
        if col in gdf.columns:
            country_col = col
            break
            
    if not country_col:
        logger.error("Could not find a country column in the shapefile.")
        return
        
    logger.info(f"Filtering using column: {country_col}")
    nigeria_floods = gdf[gdf[country_col] == "Nigeria"].copy()
    logger.info(f"Found {len(nigeria_floods)} flood polygons for Nigeria.")
    
    # Save attributes to CSV
    df = pd.DataFrame(nigeria_floods.drop(columns="geometry"))
    df.to_csv(output_csv, index=False)
    logger.info(f"Saved to {output_csv}")

if __name__ == "__main__":
    extract_dfo_nigeria()
