import feedparser
import pandas as pd
import logging
from bs4 import BeautifulSoup
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def scrape_google_news(query="Lagos flood drainage blocked", output_path="data/raw/lagos_news_floods.csv"):
    url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-NG&gl=NG&ceid=NG:en"
    logger.info(f"Fetching RSS feed from: {url}")
    
    feed = feedparser.parse(url)
    logger.info(f"Found {len(feed.entries)} articles.")
    
    articles = []
    for entry in feed.entries:
        # Extract title and published date
        title = entry.title
        link = entry.link
        pub_date = entry.published
        
        # We can extract text from summary if available
        summary = entry.get('summary', '')
        soup = BeautifulSoup(summary, "html.parser")
        text = soup.get_text(separator=' ', strip=True)
        
        # Check if the text implies blocked drainage
        is_blockage = 1 if re.search(r'block|clog|drain|canal|refuse|waste|dump', title + ' ' + text, re.IGNORECASE) else 0
        
        articles.append({
            "title": title,
            "url": link,
            "published_at": pub_date,
            "text_snippet": text,
            "is_blockage_attributed": is_blockage
        })
        
    df = pd.DataFrame(articles)
    if not df.empty:
        df.to_csv(output_path, index=False)
        logger.info(f"Saved {len(df)} news articles to {output_path}")
        logger.info(f"Blockage attributed: {df['is_blockage_attributed'].sum()} articles")
    else:
        logger.warning("No articles found!")

if __name__ == "__main__":
    scrape_google_news()
