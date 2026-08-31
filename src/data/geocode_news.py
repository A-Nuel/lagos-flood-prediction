import pandas as pd
import logging
from src.data.labels_scraper import extract_lagos_locations, geocode_area, events_to_drainage_input
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_geocoding():
    news_file = "data/raw/lagos_news_floods.csv"
    if not os.path.exists(news_file):
        logger.error(f"Cannot find {news_file}")
        return

    logger.info(f"Loading {news_file}...")
    df = pd.read_csv(news_file)
    
    # We only care about articles with blockage attributed for the spatial proxy
    df = df[df["is_blockage_attributed"] == 1].copy()
    logger.info(f"Processing {len(df)} blockage-attributed articles for geocoding...")
    
    # We need to construct a list of dicts: {"date": date, "source": url, "title": title, "text": text}
    # Then run them through the logic.
    geocoded_events = []
    
    for _, row in df.iterrows():
        text = str(row["title"]) + " " + str(row["text_snippet"])
        locations = extract_lagos_locations(text)
        
        for loc in locations:
            lat, lon = geocode_area(loc)
            if lat and lon:
                # Store the mapped event
                geocoded_events.append({
                    "date": pd.to_datetime(row["published_at"]).strftime("%Y-%m-%d") if pd.notnull(row["published_at"]) else "2024-01-01",
                    "location_name": loc,
                    "lat": lat,
                    "lon": lon,
                    "source_url": row["url"],
                    "title": row["title"],
                    "is_blockage_attributed": 1
                })
    
    if not geocoded_events:
        logger.warning("No locations could be geocoded from the news articles.")
        return
        
    mapped_df = pd.DataFrame(geocoded_events)
    logger.info(f"Successfully geocoded {len(mapped_df)} location events.")
    
    # The pipeline expects 'lagos_news_floods.csv' to contain 'lon' and 'lat'.
    # Overwrite it so make_dataset.py and drainage_pipeline.py pick it up!
    mapped_df.to_csv(news_file, index=False)
    logger.info(f"Overwrote {news_file} with geocoded data.")

if __name__ == "__main__":
    run_geocoding()
