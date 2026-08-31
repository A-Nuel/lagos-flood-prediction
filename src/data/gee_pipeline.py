import ee
import logging
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_ee(project_id=None):
    """Initialize Earth Engine"""
    try:
        if project_id:
            ee.Initialize(project=project_id)
        else:
            ee.Initialize()
        logger.info("Earth Engine initialized successfully.")
    except Exception as e:
        logger.error("Failed to initialize Earth Engine. Make sure you authenticated with 'earthengine authenticate'.")
        raise

def get_lagos_geometry():
    """Get Lagos boundary from FAO GAUL dataset"""
    lagos = ee.FeatureCollection("FAO/GAUL/2015/level1") \
        .filter(ee.Filter.eq('ADM1_NAME', 'Lagos'))
    return lagos.geometry()

def export_static_features_to_drive(folder_name='Lagos_Flood_Project'):
    """
    Exports Elevation, Slope, and Impervious surface percentage 
    at 500m scale for Lagos to Google Drive.
    """
    region = get_lagos_geometry()
    
    # Elevation and Slope from SRTM
    dem = ee.Image('USGS/SRTMGL1_003').clip(region)
    slope = ee.Terrain.slope(dem)
    
    # ESA WorldCover (10m) -> 50 = Built-up/impervious
    worldcover = ee.ImageCollection('ESA/WorldCover/v200').first().clip(region)
    impervious = worldcover.eq(50).rename('impervious')
    
    # Combine static features and cast to Float32 to prevent GEE type mismatch errors
    static_img = dem.addBands(slope).addBands(impervious).toFloat()
    
    # Export task
    task = ee.batch.Export.image.toDrive(
        image=static_img,
        description='lagos_static_features_500m',
        folder=folder_name,
        scale=500,
        region=region,
        crs='EPSG:4326',
        maxPixels=1e9
    )
    task.start()
    logger.info(f"Started export task for static features: {task.status()}")
    return task

def export_rainfall_to_drive(start_year=2010, end_year=2024, folder_name='Lagos_Flood_Project'):
    """
    Exports CHIRPS daily rainfall aggregated at 500m scale to Google Drive.
    Since 14 years is large, we export year by year as an Image where 
    each band is a day.
    """
    region = get_lagos_geometry()
    
    tasks = []
    for year in range(start_year, end_year + 1):
        start_date = f'{year}-01-01'
        end_date = f'{year}-12-31'
        
        chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY') \
            .filterDate(start_date, end_date) \
            .filterBounds(region)
            
        # Convert ImageCollection to a single Image with each date as a band
        def rename_band(img):
            date_str = img.date().format('YYYY_MM_dd')
            return img.rename(date_str)
            
        yearly_img = chirps.map(rename_band).toBands()
        
        task = ee.batch.Export.image.toDrive(
            image=yearly_img,
            description=f'lagos_chirps_daily_{year}',
            folder=folder_name,
            scale=500,
            region=region,
            crs='EPSG:4326',
            maxPixels=1e10
        )
        task.start()
        tasks.append(task)
        logger.info(f"Started CHIRPS export for {year}: {task.status()}")
        
    return tasks

if __name__ == "__main__":
    # Example usage:
    # initialize_ee()
    # export_static_features_to_drive()
    # export_rainfall_to_drive(start_year=2010, end_year=2024)
    pass
