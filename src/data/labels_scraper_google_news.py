import feedparser
import pandas as pd
import logging
from bs4 import BeautifulSoup
import re
import urllib.parse
from datetime import datetime
import calendar
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def scrape_google_news_advanced(output_path="data/raw/lagos_news_floods_raw.csv"):
    years = [2022, 2023, 2024]
    months = [4, 5, 6, 7, 8, 9, 10]  # April to October
    base_queries = ["Lagos flood", "Lagos drainage", "Lagos rainfall flood", "Lagos canal blockage", "LASEMA flood Lagos"]
    
    all_articles = []
    seen_links = set()
    
    for year in years:
        for month in months:
            # Get last day of the month
            _, last_day = calendar.monthrange(year, month)
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{last_day}"
            
            for base_query in base_queries:
                query_str = f"{base_query} after:{start_date} before:{end_date}"
                encoded_query = urllib.parse.quote(query_str)
                url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-NG&gl=NG&ceid=NG:en"
                
                logger.info(f"Fetching: {query_str}")
                try:
                    feed = feedparser.parse(url)
                    for entry in feed.entries:
                        link = entry.link
                        if link in seen_links:
                            continue
                        seen_links.add(link)
                        
                        title = entry.title
                        pub_date = entry.get('published', '')
                        
                        summary = entry.get('summary', '')
                        soup = BeautifulSoup(summary, "html.parser")
                        text = soup.get_text(separator=' ', strip=True)
                        
                        is_blockage = 1 if re.search(r'block|clog|drain|canal|refuse|waste|dump|gutter|culvert', title + ' ' + text, re.IGNORECASE) else 0
                        
                        # Parse structured date
                        parsed_date = None
                        if hasattr(entry, 'published_parsed') and entry.published_parsed:
                            parsed_date = datetime(*entry.published_parsed[:6]).strftime("%Y-%m-%d")
                        else:
                            parsed_date = f"{year}-{month:02d}-15"
                            
                        all_articles.append({
                            "title": title,
                            "url": link,
                            "published_at": parsed_date,
                            "text_snippet": text,
                            "is_blockage_attributed": is_blockage
                        })
                except Exception as e:
                    logger.warning(f"Error fetching {query_str}: {e}")
                
                time.sleep(0.5)  # Polite delay
                
    df = pd.DataFrame(all_articles)
    
    # Merge with LASEMA data if it exists
    lasema_path = "data/raw/lasema_floods.csv"
    import os
    if os.path.exists(lasema_path):
        try:
            df_lasema = pd.read_csv(lasema_path)
            # Standardize date format for LASEMA
            if "published_at" in df_lasema.columns:
                df_lasema["published_at"] = df_lasema["published_at"].apply(
                    lambda x: f"{x}-15" if len(str(x)) == 7 else str(x)
                )
            df = pd.concat([df, df_lasema], ignore_index=True)
            logger.info("Merged LASEMA reports.")
        except Exception as e:
            logger.error(f"Could not merge LASEMA: {e}")

    if not df.empty:
        df.drop_duplicates(subset=["title"], inplace=True)
        df.to_csv(output_path, index=False)
        logger.info(f"Saved {len(df)} total unique articles to {output_path}")
        logger.info(f"Blockage attributed: {df['is_blockage_attributed'].sum()} articles")
    else:
        logger.warning("No articles found!")

if __name__ == "__main__":
    scrape_google_news_advanced()
