# Flood Risk Prediction System for Lagos, Nigeria

This project is a machine learning pipeline that classifies and predicts flood risk across Lagos State based on rainfall, elevation, land use, and infrastructure data.

## ⚠️ Expectation Management
**What this model does:** Predicts flood *susceptibility* from terrain, rainfall, and infrastructure proxies (road density, distance to waterways).
**What this model does NOT do:** It does not model literal drain blockages. Since there is no comprehensive public data on which specific drains are blocked, the model relies on structural and environmental proxies. Furthermore, the model operates at a 500m grid resolution, which captures neighborhood-level risk but may wash out street-level, single-drain blockage effects (which often occur at a <100m scale).

## Data Sources
- **Rainfall:** CHIRPS via Google Earth Engine (Daily granularity)
- **Elevation/Terrain:** NASA SRTM 30m DEM
- **Land Use:** ESA WorldCover
- **Infrastructure:** OpenStreetMap (OSMnx) for road network and waterways
- **Ground Truth (Labels):** 
  - Dartmouth Flood Observatory (DFO)
  - LASEMA / NEMA Situation Reports (Manual extraction)
  - Nigerian News Archives (Punch, Guardian NG, Vanguard)

## Setup Instructions
1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Authenticate with Google Earth Engine:
   ```bash
   earthengine authenticate
   ```

## Project Structure
- `data/`: Raw, interim, and processed data.
- `notebooks/`: Jupyter notebooks for data extraction and EDA.
- `src/`: Python source code for data pipelines, feature engineering, and modeling.
- `app/`: Scaffold for a future FastAPI deployment.
