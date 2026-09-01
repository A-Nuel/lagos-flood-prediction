import pandas as pd
import logging
from src.data.labels_scraper import extract_lagos_locations, geocode_area, events_to_drainage_input
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_geocoding(
    input_file="data/raw/lagos_news_floods_raw.csv",
    output_file="data/raw/lagos_news_floods.csv"
):
    if not os.path.exists(input_file):
        if os.path.exists(output_file):
            input_file = output_file
        else:
            logger.error(f"Cannot find input news file: {input_file}")
            return

    logger.info(f"Loading {input_file}...")
    df = pd.read_csv(input_file)
    logger.info(f"Processing {len(df)} articles for geocoding...")
    
    geocoded_events = []
    
    for _, row in df.iterrows():
        text = str(row.get("title", "")) + " " + str(row.get("text_snippet", ""))
        locations = extract_lagos_locations(text)
        
        # If no specific neighborhood found, check if Lagos is in text and fallback to key hubs if specified
        pub_date = row.get("published_at")
        try:
            date_str = pd.to_datetime(pub_date).strftime("%Y-%m-%d")
        except Exception:
            date_str = "2024-06-15"
            
        for loc in locations:
            coords = geocode_area(loc)
            if coords:
                lat, lon = coords
                geocoded_events.append({
                    "date": date_str,
                    "location_name": loc,
                    "lat": lat,
                    "lon": lon,
                    "source_url": row.get("url", ""),
                    "title": row.get("title", ""),
                    "is_blockage_attributed": int(row.get("is_blockage_attributed", 0))
                })
    
    if not geocoded_events:
        logger.warning("No locations could be geocoded from the news articles.")
        return
        
    mapped_df = pd.DataFrame(geocoded_events)
    # Deduplicate same location on same date
    mapped_df.drop_duplicates(subset=["date", "location_name", "title"], inplace=True)
    logger.info(f"Successfully geocoded {len(mapped_df)} location events across {mapped_df['location_name'].nunique()} unique Lagos locations.")
    
    mapped_df.to_csv(output_file, index=False)
    logger.info(f"Saved geocoded events to {output_file}.")

if __name__ == "__main__":
    run_geocoding()
