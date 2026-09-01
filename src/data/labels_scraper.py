"""
labels_scraper.py
-----------------
Scrapes and parses flood event data from:
  1. LASEMA / NEMA PDF / text situation reports (manual parse)
  2. Nigerian news archives (Punch, Vanguard, Guardian NG)
  3. Dartmouth Flood Observatory (DFO) CSV

Key feature: detects BLOCKAGE LANGUAGE in article text so that
drainage_pipeline.py can map those events as blockage incidents
to their grid cells.

BLOCKAGE KEYWORDS (used to flag blockage_mentioned = True):
  blocked drain, blocked gutter, choked drain, clogged canal,
  debris, refuse dump, blocked culvert, poor drainage,
  drainage blockage, blocked waterway, waterlogged road
"""

import re
import logging
import requests
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# BLOCKAGE LANGUAGE DETECTION
# ─────────────────────────────────────────────────────────

BLOCKAGE_PATTERNS = re.compile(
    r"block(?:ed|age)?\s+(?:drain|gutter|canal|culvert|waterway)"
    r"|choked?\s+(?:drain|canal|gutter)"
    r"|clogged?\s+(?:drain|canal|gutter|culvert)"
    r"|debris\s+(?:in|blocking|chok)"
    r"|refuse\s+(?:dump|dispos)"
    r"|poor\s+drainage"
    r"|drainage\s+(?:blockage|problem|issue|failure)"
    r"|waterlogged\s+(?:road|street|area)"
    r"|open\s+(?:gutter|drain)",
    re.IGNORECASE
)

LAGOS_AREA_PATTERNS = re.compile(
    r"\b(Lekki|Victoria Island|Ikeja|Surulere|Mushin|Oshodi|Agege|"
    r"Badagry|Epe|Ikorodu|Lagos Island|Apapa|Ojota|Festac|Ojo|"
    r"Alimosho|Ifako|Kosofe|Shomolu|Gbagada|Magodo|Ajah|Sangotedo|"
    r"Ibeju|Maryland|Yaba|Ebute Metta|Isale Eko|Somolu|Ipaja|Egbeda|"
    r"Agungi|Ajiran|Ikota|Bariga|Marina|Okokomaiko|Isashi|Iba|"
    r"Ogombo|Abraham Adesanya|Akowonjo|Ilupeju|Oregun|Anthony)\b",
    re.IGNORECASE
)


def detect_blockage(text: str) -> bool:
    """Returns True if article text mentions drainage blockage."""
    return bool(BLOCKAGE_PATTERNS.search(text))


def extract_lagos_locations(text: str) -> list:
    """Extracts Lagos area names mentioned in text."""
    return list(set(LAGOS_AREA_PATTERNS.findall(text)))


# ─────────────────────────────────────────────────────────
# APPROXIMATE GEOCODER FOR LAGOS AREAS
# (no external API needed — baked-in reference coordinates)
# ─────────────────────────────────────────────────────────

LAGOS_AREA_COORDS = {
    "Lekki":            (6.4698, 3.5852),
    "Victoria Island":   (6.4281, 3.4219),
    "Ikeja":            (6.5958, 3.3392),
    "Surulere":         (6.4966, 3.3539),
    "Mushin":           (6.5244, 3.3580),
    "Oshodi":           (6.5567, 3.3500),
    "Agege":            (6.6166, 3.3213),
    "Badagry":          (6.4175, 2.8849),
    "Epe":              (6.5840, 3.9795),
    "Ikorodu":          (6.6194, 3.5062),
    "Lagos Island":     (6.4541, 3.3947),
    "Apapa":            (6.4490, 3.3596),
    "Ojota":            (6.5820, 3.3813),
    "Festac":           (6.4685, 3.2728),
    "Ojo":              (6.4702, 3.1416),
    "Alimosho":         (6.6059, 3.2709),
    "Ifako":            (6.6381, 3.3414),
    "Kosofe":           (6.5897, 3.3936),
    "Shomolu":          (6.5344, 3.3792),
    "Gbagada":          (6.5511, 3.3799),
    "Magodo":           (6.5997, 3.3764),
    "Ajah":             (6.4698, 3.5852),
    "Sangotedo":        (6.4374, 3.6523),
    "Ibeju":            (6.4469, 3.7238),
    "Maryland":         (6.5653, 3.3594),
    "Yaba":             (6.5096, 3.3760),
    "Ebute Metta":      (6.4889, 3.3776),
    "Isale Eko":        (6.4549, 3.3917),
    "Somolu":           (6.5344, 3.3792),
    "Ipaja":            (6.6111, 3.2683),
    "Egbeda":           (6.6018, 3.2925),
    "Agungi":           (6.4370, 3.5280),
    "Ajiran":           (6.4350, 3.5400),
    "Ikota":            (6.4300, 3.5500),
    "Bariga":           (6.5385, 3.3890),
    "Marina":           (6.4530, 3.3900),
    "Okokomaiko":       (6.4800, 3.1900),
    "Isashi":           (6.4900, 3.1800),
    "Iba":              (6.5100, 3.2000),
    "Ogombo":           (6.4500, 3.5700),
    "Abraham Adesanya": (6.4600, 3.6000),
    "Akowonjo":         (6.6018, 3.2925),
    "Ilupeju":          (6.5500, 3.3600),
    "Oregun":           (6.6000, 3.3600),
    "Anthony":          (6.5600, 3.3700),
}


def geocode_area(area_name: str) -> Optional[tuple]:
    """Returns (lat, lon) for a known Lagos area, or None."""
    for key, coords in LAGOS_AREA_COORDS.items():
        if key.lower() in area_name.lower():
            return coords
    return None


# ─────────────────────────────────────────────────────────
# NEWS SCRAPER — Nigerian News Sites
# ─────────────────────────────────────────────────────────

NEWS_SOURCES = {
    "punch": "https://punchng.com/?s=flood+lagos",
    "vanguard": "https://www.vanguardngr.com/?s=flood+lagos+drainage",
    "guardian": "https://guardian.ng/?s=flood+lagos",
}


def scrape_news_article(url: str, timeout: int = 10) -> Optional[dict]:
    """
    Fetches and parses a single news article URL.
    Returns dict with: url, title, date, text, blockage_mentioned, locations
    """
    try:
        headers = {"User-Agent": "Mozilla/5.0 (research project)"}
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Generic extractors — works across most Nigerian news sites
        title = soup.find("h1")
        title_text = title.get_text(strip=True) if title else ""

        # Try common article body selectors
        body = (
            soup.find("div", class_=re.compile(r"article|content|post|entry|story", re.I))
            or soup.find("article")
            or soup.body
        )
        body_text = body.get_text(separator=" ", strip=True) if body else ""
        full_text = f"{title_text} {body_text}"

        # Try to extract date from meta tags
        date_meta = (
            soup.find("meta", {"property": "article:published_time"})
            or soup.find("meta", {"name": "date"})
            or soup.find("time")
        )
        date_str = None
        if date_meta:
            date_str = date_meta.get("content") or date_meta.get("datetime") or date_meta.get_text()

        locations = extract_lagos_locations(full_text)

        return {
            "url": url,
            "title": title_text,
            "date": date_str,
            "text_snippet": body_text[:500],
            "blockage_mentioned": detect_blockage(full_text),
            "locations_mentioned": locations,
        }

    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        return None


def scrape_news_search(
    source: str = "punch",
    query: str = "flood lagos drainage blocked",
    max_articles: int = 50
) -> pd.DataFrame:
    """
    Searches a Nigerian news site for flood+Lagos articles and scrapes each result.
    Returns a DataFrame of extracted articles with blockage detection applied.

    Usage:
        df = scrape_news_search(source="punch", max_articles=30)
        df.to_csv("data/raw/news_flood_articles.csv", index=False)
    """
    search_urls = {
        "punch":    f"https://punchng.com/?s={query.replace(' ', '+')}",
        "vanguard": f"https://www.vanguardngr.com/?s={query.replace(' ', '+')}",
        "guardian": f"https://guardian.ng/?s={query.replace(' ', '+')}",
    }

    search_url = search_urls.get(source)
    if not search_url:
        raise ValueError(f"Unknown source: {source}. Choose from: {list(search_urls.keys())}")

    logger.info(f"Searching {source} for: '{query}'")

    headers = {"User-Agent": "Mozilla/5.0 (research project)"}
    try:
        resp = requests.get(search_url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.error(f"Failed to fetch search results from {source}: {e}")
        return pd.DataFrame()

    # Find article links from search results
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Filter for article-like URLs (exclude pagination, category pages)
        if (
            source.replace("punchng", "punch") in href
            and len(href) > 40
            and href not in links
            and "page" not in href
            and "category" not in href
        ):
            links.append(href)
        if len(links) >= max_articles:
            break

    logger.info(f"Found {len(links)} article links on {source}.")

    results = []
    for url in links:
        article = scrape_news_article(url)
        if article:
            results.append(article)

    if not results:
        return pd.DataFrame()

    df = pd.DataFrame(results)
    blockage_count = df["blockage_mentioned"].sum()
    logger.info(
        f"Scraped {len(df)} articles from {source}. "
        f"Blockage events: {blockage_count} ({100*blockage_count/len(df):.0f}%)"
    )
    return df


# ─────────────────────────────────────────────────────────
# LASEMA / NEMA REPORT PARSER
# ─────────────────────────────────────────────────────────

def parse_lasema_reports(file_path: str) -> pd.DataFrame:
    """
    Parse LASEMA/NEMA situation reports into a structured DataFrame.
    Supports CSV or plain text files.

    Expected columns (CSV) or patterns (text):
        Date, Location, LGA, Description, Severity

    Download reports from:
        https://www.lasema.lagos.gov.ng/situation-reports/
        https://www.nema.gov.ng/

    Returns DataFrame with blockage_mentioned and locations columns added.
    """
    logger.info(f"Parsing LASEMA reports from: {file_path}")
    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            # Split into chunks by date pattern (common in LASEMA reports)
            chunks = re.split(r"\n(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", content)
            records = []
            for chunk in chunks:
                date_match = re.search(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", chunk)
                records.append({
                    "date": date_match.group() if date_match else None,
                    "description": chunk.strip(),
                })
            df = pd.DataFrame(records)

        # Apply blockage detection
        text_col = "description" if "description" in df.columns else df.columns[-1]
        df["blockage_mentioned"] = df[text_col].astype(str).apply(detect_blockage)
        df["locations_mentioned"] = df[text_col].astype(str).apply(extract_lagos_locations)

        blockage_count = df["blockage_mentioned"].sum()
        logger.info(f"Parsed {len(df)} LASEMA records. Blockage events: {blockage_count}")
        return df

    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return pd.DataFrame()


# ─────────────────────────────────────────────────────────
# CONVERT SCRAPED EVENTS → DRAINAGE PIPELINE FORMAT
# ─────────────────────────────────────────────────────────

def events_to_drainage_input(articles_df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts scraped/parsed news article DataFrame into the format expected
    by drainage_pipeline.map_blockage_events_to_grid().

    Output columns: lat, lon, date, blockage_mentioned, severity
    One row per location mentioned per article (an article can yield
    multiple rows if it mentions multiple Lagos areas).
    """
    rows = []
    for _, row in articles_df.iterrows():
        if not row.get("blockage_mentioned"):
            continue
        locations = row.get("locations_mentioned", [])
        if not locations:
            continue
        for loc in locations:
            coords = geocode_area(loc)
            if coords:
                rows.append({
                    "lat": coords[0],
                    "lon": coords[1],
                    "date": row.get("date"),
                    "location_name": loc,
                    "blockage_mentioned": True,
                    "severity": "unknown",
                    "source": row.get("url", "unknown"),
                })

    if not rows:
        logger.warning("No geocodeable blockage events found in articles.")
        return pd.DataFrame(
            columns=["lat", "lon", "date", "location_name",
                     "blockage_mentioned", "severity", "source"]
        )

    result = pd.DataFrame(rows)
    logger.info(f"Converted {len(articles_df)} articles → {len(result)} geocoded blockage events.")
    return result


# ─────────────────────────────────────────────────────────
# SMOKE TEST
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Test blockage detection locally (no network needed)
    test_texts = [
        "Heavy rainfall caused flooding in Lekki due to blocked drainage channels.",
        "The Oshodi-Apapa expressway was waterlogged after rain. Clogged gutters were blamed.",
        "Government to repair roads in Ikeja next week.",
        "Residents of Surulere decry poor drainage and refuse dumps blocking canals.",
    ]
    print("=== Blockage Detection Smoke Test ===")
    for text in test_texts:
        blocked = detect_blockage(text)
        locs = extract_lagos_locations(text)
        print(f"  Blockage: {blocked} | Locations: {locs}")
        print(f"  Text: {text[:80]}...")
        print()
