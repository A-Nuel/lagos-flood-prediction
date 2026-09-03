import os
import json
import logging
from typing import List, Optional, Dict, Any, Literal
from pathlib import Path
from contextlib import asynccontextmanager
from functools import lru_cache

import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lagos-flood-api")

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Load Assets via Modern Lifespan Handler ──────────────
rf_model = None
xgb_model = None
grid_gdf = None
grid_features_df = None

FEATURES_ORDER = [
    "rainfall_mm", "rainfall_3d_sum", "rainfall_7d_sum", "is_rainy_season",
    "elevation_m", "slope_deg", "impervious_pct", "road_density",
    "dist_to_water_m", "drain_density", "drain_coverage_gap", "composite_blockage_risk"
]

def load_assets():
    global rf_model, xgb_model, grid_gdf, grid_features_df
    try:
        rf_path = BASE_DIR / "models" / "rf_baseline.joblib"
        if rf_model is None and rf_path.exists():
            rf_model = joblib.load(str(rf_path))
            logger.info("Loaded Random Forest model.")

        xgb_path = BASE_DIR / "models" / "xgb_baseline.json"
        if xgb_model is None and xgb_path.exists():
            xgb_model = xgb.XGBClassifier()
            xgb_model.load_model(str(xgb_path))
            logger.info("Loaded XGBoost model.")

        grid_path = BASE_DIR / "data" / "interim" / "grid_enriched.geojson"
        if grid_gdf is None and grid_path.exists():
            with open(grid_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            records = [feat.get("properties", {}) for feat in data.get("features", [])]
            grid_gdf = pd.DataFrame(records)
            for col in ["elevation_m", "slope_deg", "impervious_pct", "road_density", "dist_to_water_m", "drain_density", "drain_coverage_gap", "composite_blockage_risk"]:
                if col in grid_gdf.columns:
                    grid_gdf[col] = grid_gdf[col].fillna(0)
            grid_features_df = grid_gdf
            logger.info(f"Loaded {len(grid_gdf)} grid cells from {grid_path}.")
    except Exception as e:
        logger.error(f"Error loading assets: {e}")

def ensure_assets_loaded():
    if rf_model is None or xgb_model is None or grid_gdf is None:
        load_assets()

# Pre-load assets on module import for serverless environments
ensure_assets_loaded()


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_assets()
    yield

app = FastAPI(
    title="Lagos Flood Risk Prediction API",
    description="Early-stage machine learning risk indicators for urban flood safety in Lagos State, Nigeria.",
    version="1.0.0",
    lifespan=lifespan
)


# ── CORS Configuration (Defense-in-depth) ────────────────
raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
is_wildcard = origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=not is_wildcard,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

DISCLAIMER_TEXT = (
    "Trained on 499 known flood events across 28 confirmed locations in Lagos — "
    "an early-stage indicator, not a certified forecast. Precision and recall are "
    "moderate (~50%), meaning roughly half of flagged alerts may be false alarms, "
    "and some real flood risk may be missed. Moderate and severe alerts explicitly "
    "prioritize catching real floods (up to 92% sensitivity) over avoiding false alarms."
)

MODEL_METRICS = {
    "evaluation_method": "5-Fold Spatial GroupKFold Cross-Validation (Zero Spatial Leakage)",
    "total_historical_events": 499,
    "unique_positive_locations": 28,
    "random_forest": {
        "roc_auc": 0.9524,
        "pr_auc": 0.4613,
        "tiers": {
            "low": {"threshold": "< 0.20", "label": "Low Risk / Normal", "color": "#10B981"},
            "moderate": {"threshold": "0.20 - 0.35", "label": "Moderate Advisory", "recall": "91.8%", "precision": "20.0%", "color": "#F59E0B"},
            "severe": {"threshold": ">= 0.35", "label": "Severe Flood Warning", "recall": "78.0%", "precision": "21.5%", "color": "#EF4444"}
        }
    },
    "xgboost": {
        "roc_auc": 0.9591,
        "pr_auc": 0.5607,
        "tiers": {
            "low": {"threshold": "< 0.10", "label": "Low Risk / Normal", "color": "#10B981"},
            "moderate": {"threshold": "0.10 - 0.35", "label": "Moderate Advisory", "recall": "63.1%", "precision": "27.4%", "color": "#F59E0B"},
            "severe": {"threshold": ">= 0.35", "label": "Severe Flood Warning", "recall": "52.5%", "precision": "51.5%", "color": "#EF4444"}
        }
    }
}

KEY_LAGOS_HUBS = [
    {"name": "Alimosho (Ipaja/Egbeda)", "lat": 6.6059, "lon": 3.2709, "description": "High population density with vulnerable canal drainage"},
    {"name": "Lekki Phase 1 / Agungi", "lat": 6.4698, "lon": 3.5852, "description": "Low-lying coastal corridor susceptible to drainage blockage"},
    {"name": "Surulere (Fashoro / Idi-Araba)", "lat": 6.4966, "lon": 3.3539, "description": "Urban basin with historical drainage overflow"},
    {"name": "Ikeja / Maryland", "lat": 6.5958, "lon": 3.3392, "description": "Commercial hub with mixed terrain and storm drain networks"},
    {"name": "Gbagada / Bariga Canal", "lat": 6.5511, "lon": 3.3799, "description": "Major canal discharge zone into Lagos Lagoon"},
    {"name": "Oshodi / Mushin", "lat": 6.5567, "lon": 3.3500, "description": "Dense commercial corridor with high impervious surface"},
    {"name": "Lagos Island / Marina", "lat": 6.4541, "lon": 3.3947, "description": "Tidal influence zone with low elevation (<2m)"},
    {"name": "Ikorodu Lowlands", "lat": 6.6194, "lon": 3.5062, "description": "Riverine plain bordering the Ogun River basin"},
    {"name": "Agege / Ifako", "lat": 6.6166, "lon": 3.3213, "description": "Urban residential grid with historical stormwater runoff"},
    {"name": "Epe Waterfront", "lat": 6.5840, "lon": 3.9795, "description": "Eastern lagoon perimeter"}
]

# Ensure assets are loaded immediately if imported without lifespan
load_assets()

# ── Pydantic Request & Response Schemas ───────────────────

class SinglePredictionRequest(BaseModel):
    grid_id: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=4.0, le=14.0, description="Latitude in Nigeria bounds")
    lon: Optional[float] = Field(default=None, ge=2.0, le=15.0, description="Longitude in Nigeria bounds")
    rainfall_mm: float = Field(default=25.0, ge=0.0, le=500.0, description="Daily 24h rainfall in mm")
    rainfall_3d_sum: float = Field(default=60.0, ge=0.0, le=1000.0, description="3-day cumulative rainfall in mm")
    rainfall_7d_sum: float = Field(default=120.0, ge=0.0, le=2000.0, description="7-day cumulative rainfall in mm")
    is_rainy_season: Literal[0, 1] = Field(default=1, description="1 if rainy season (Apr-Oct), 0 otherwise")
    blockage_multiplier: float = Field(default=1.0, ge=0.1, le=5.0, description="Multiplier for blockage risk (e.g., 1.5 = 50% increase)")
    model_choice: Literal["random_forest", "xgboost"] = Field(default="random_forest", description="'random_forest' (Option B - Safety Default) or 'xgboost' (Option A)")


class SimulationRequest(BaseModel):
    rainfall_mm: float = Field(default=35.0, ge=0.0, le=500.0, description="Daily rainfall mm")
    rainfall_3d_sum: float = Field(default=80.0, ge=0.0, le=1000.0, description="3-day rainfall sum mm")
    rainfall_7d_sum: float = Field(default=150.0, ge=0.0, le=2000.0, description="7-day rainfall sum mm")
    is_rainy_season: Literal[0, 1] = Field(default=1, description="Rainy season active (1 or 0)")
    blockage_multiplier: float = Field(default=1.0, ge=0.1, le=5.0, description="Blockage risk multiplier (0.5 to 2.5)")
    model_choice: Literal["random_forest", "xgboost"] = Field(default="random_forest", description="'random_forest' or 'xgboost'")


# ── Helper Functions ───────────────────────────────────────

def classify_tier(prob: float, model_type: str = "random_forest") -> Dict[str, Any]:
    if model_type == "random_forest":
        if prob >= 0.35:
            return {"tier": "Severe Warning", "code": "severe", "color": "#EF4444", "action": "Urgent Precaution: Move valuables, avoid floodways, prepare evacuation routes."}
        elif prob >= 0.20:
            return {"tier": "Moderate Advisory", "code": "moderate", "color": "#F59E0B", "action": "Safety Warning (92% Sensitivity): Inspect local drainage, clear gutters, monitor rainfall."}
        else:
            return {"tier": "Low Risk", "code": "low", "color": "#10B981", "action": "Normal baseline conditions. Standard vigilance."}
    else:  # xgboost
        if prob >= 0.35:
            return {"tier": "Severe Warning", "code": "severe", "color": "#EF4444", "action": "High-Confidence Alert (>50% Precision): Critical flood danger expected."}
        elif prob >= 0.10:
            return {"tier": "Moderate Advisory", "code": "moderate", "color": "#F59E0B", "action": "Precautionary Advisory (63% Recall): Localized street ponding possible."}
        else:
            return {"tier": "Low Risk", "code": "low", "color": "#10B981", "action": "Normal baseline conditions."}


from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ── In-Memory Simulation Cache ─────────────────────────────
_simulation_cache: Dict[str, Dict[str, Any]] = {}

# ── API Routes ─────────────────────────────────────────────

@app.get("/api")
def api_root():
    return {
        "service": "Lagos Flood Risk Prediction API",
        "status": "online",
        "default_model": "Option B: Random Forest (Prioritizing Safety & Recall)",
        "disclaimer": DISCLAIMER_TEXT,
        "docs_url": "/docs"
    }

# Check if compiled frontend dist exists (e.g. In Docker container)
dist_dir = Path("frontend/dist")
if dist_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(dist_dir / "assets")), name="assets")

    @app.get("/")
    def serve_frontend_index():
        return FileResponse(dist_dir / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "service": "Lagos Flood Risk Prediction API",
            "status": "online",
            "default_model": "Option B: Random Forest (Prioritizing Safety & Recall)",
            "disclaimer": DISCLAIMER_TEXT,
            "docs_url": "/docs"
        }


@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "models_loaded": {
            "random_forest": rf_model is not None,
            "xgboost": xgb_model is not None
        },
        "grid_cells_count": len(grid_gdf) if grid_gdf is not None else 0,
        "disclaimer": DISCLAIMER_TEXT,
        "metrics": MODEL_METRICS
    }


@app.get("/api/key-locations")
def get_key_locations():
    return {
        "locations": KEY_LAGOS_HUBS,
        "disclaimer": DISCLAIMER_TEXT
    }


@app.get("/api/grid-summary")
def get_grid_summary(sample_limit: int = Query(default=1500, ge=10, le=10000, description="Max cells to return for web view")):
    """Returns essential grid cell properties and centroids for map rendering."""
    if grid_gdf is None:
        raise HTTPException(status_code=500, detail="Grid data not loaded")
    
    stride = max(1, len(grid_gdf) // max(1, sample_limit))
    sub_gdf = grid_gdf.iloc[::stride].copy()
    
    features = []
    for _, row in sub_gdf.iterrows():
        features.append({
            "grid_id": row["grid_id"],
            "lat": float(row["centroid_lat"]),
            "lon": float(row["centroid_lon"]),
            "elevation_m": float(row.get("elevation_m", 10.0)),
            "slope_deg": float(row.get("slope_deg", 0.5)),
            "impervious_pct": float(row.get("impervious_pct", 30.0)),
            "drain_density": float(row.get("drain_density", 0.0)),
            "composite_blockage_risk": float(row.get("composite_blockage_risk", 0.2)),
        })
        
    return {
        "count": len(features),
        "total_cells": len(grid_gdf),
        "cells": features,
        "disclaimer": DISCLAIMER_TEXT
    }


@app.post("/api/predict")
def predict_flood_risk(req: SinglePredictionRequest):
    if rf_model is None or xgb_model is None or grid_gdf is None:
        raise HTTPException(status_code=500, detail="Models or grid data unavailable")

    matched_row = None
    if req.grid_id and req.grid_id in grid_gdf["grid_id"].values:
        matched_row = grid_gdf[grid_gdf["grid_id"] == req.grid_id].iloc[0]
    elif req.lat is not None and req.lon is not None:
        dists = (grid_gdf["centroid_lat"] - req.lat)**2 + (grid_gdf["centroid_lon"] - req.lon)**2
        matched_row = grid_gdf.iloc[dists.argmin()]
    else:
        matched_row = grid_gdf.iloc[0]

    elev = float(matched_row.get("elevation_m", 10.0))
    slope = float(matched_row.get("slope_deg", 0.5))
    impervious = float(matched_row.get("impervious_pct", 30.0))
    road_dens = float(matched_row.get("road_density", 0.0))
    dist_water = float(matched_row.get("dist_to_water_m", 500.0))
    drain_dens = float(matched_row.get("drain_density", 0.0))
    drain_gap = float(matched_row.get("drain_coverage_gap", 0.0))
    blockage = float(matched_row.get("composite_blockage_risk", 0.2)) * req.blockage_multiplier
    blockage = min(1.0, max(0.0, blockage))

    feature_values = [
        req.rainfall_mm,
        req.rainfall_3d_sum,
        req.rainfall_7d_sum,
        req.is_rainy_season,
        elev,
        slope,
        impervious,
        road_dens,
        dist_water,
        drain_dens,
        drain_gap,
        blockage
    ]

    X_input = pd.DataFrame([feature_values], columns=FEATURES_ORDER)

    rf_prob = float(rf_model.predict_proba(X_input)[0, 1])
    xgb_prob = float(xgb_model.predict_proba(X_input)[0, 1])

    active_model = req.model_choice.lower()
    selected_prob = rf_prob if active_model == "random_forest" else xgb_prob
    tier_info = classify_tier(selected_prob, active_model)

    return {
        "grid_id": matched_row["grid_id"],
        "lat": float(matched_row["centroid_lat"]),
        "lon": float(matched_row["centroid_lon"]),
        "selected_model": "Option B: Random Forest (Safety Default)" if active_model == "random_forest" else "Option A: XGBoost",
        "flood_probability": round(selected_prob, 4),
        "flood_probability_pct": f"{selected_prob*100:.1f}%",
        "risk_tier": tier_info["tier"],
        "tier_code": tier_info["code"],
        "tier_color": tier_info["color"],
        "recommended_action": tier_info["action"],
        "model_comparison": {
            "random_forest_prob": round(rf_prob, 4),
            "xgboost_prob": round(xgb_prob, 4)
        },
        "cell_features": {
            "elevation_m": round(elev, 2),
            "slope_deg": round(slope, 3),
            "impervious_pct": round(impervious, 1),
            "drain_density": round(drain_dens, 6),
            "composite_blockage_risk": round(blockage, 3),
            "rainfall_24h_mm": req.rainfall_mm,
            "rainfall_7d_sum_mm": req.rainfall_7d_sum
        },
        "disclaimer": DISCLAIMER_TEXT
    }


@app.post("/api/simulate")
def run_simulation(sim: SimulationRequest):
    """Batch calculation across all grid cells for interactive map simulation."""
    if rf_model is None or xgb_model is None or grid_gdf is None:
        raise HTTPException(status_code=500, detail="Models or grid data unavailable")

    cache_key = f"{sim.rainfall_mm}_{sim.rainfall_3d_sum}_{sim.rainfall_7d_sum}_{sim.is_rainy_season}_{sim.blockage_multiplier}_{sim.model_choice}"
    if cache_key in _simulation_cache:
        return _simulation_cache[cache_key]

    stride = max(1, len(grid_gdf) // 1200)
    sub = grid_gdf.iloc[::stride].copy()

    n = len(sub)
    blockages = (sub["composite_blockage_risk"].fillna(0.2) * sim.blockage_multiplier).clip(0.0, 1.0)
    
    sim_df = pd.DataFrame({
        "rainfall_mm": np.full(n, sim.rainfall_mm),
        "rainfall_3d_sum": np.full(n, sim.rainfall_3d_sum),
        "rainfall_7d_sum": np.full(n, sim.rainfall_7d_sum),
        "is_rainy_season": np.full(n, sim.is_rainy_season),
        "elevation_m": sub["elevation_m"].fillna(10.0).values,
        "slope_deg": sub["slope_deg"].fillna(0.5).values,
        "impervious_pct": sub["impervious_pct"].fillna(30.0).values,
        "road_density": sub["road_density"].fillna(0.0).values,
        "dist_to_water_m": sub["dist_to_water_m"].fillna(500.0).values,
        "drain_density": sub["drain_density"].fillna(0.0).values,
        "drain_coverage_gap": sub["drain_coverage_gap"].fillna(0.0).values,
        "composite_blockage_risk": blockages.values
    })

    sim_df = sim_df[FEATURES_ORDER]

    if sim.model_choice.lower() == "xgboost":
        probs = xgb_model.predict_proba(sim_df)[:, 1]
    else:
        probs = rf_model.predict_proba(sim_df)[:, 1]

    results = []
    severe_count = 0
    moderate_count = 0
    low_count = 0

    for i, (_, row) in enumerate(sub.iterrows()):
        p = float(probs[i])
        t_info = classify_tier(p, sim.model_choice.lower())
        if t_info["code"] == "severe":
            severe_count += 1
        elif t_info["code"] == "moderate":
            moderate_count += 1
        else:
            low_count += 1

        results.append({
            "grid_id": row["grid_id"],
            "lat": float(row["centroid_lat"]),
            "lon": float(row["centroid_lon"]),
            "p": round(p, 3),
            "tier": t_info["code"],
            "color": t_info["color"],
            "elev": round(float(row.get("elevation_m", 10.0)), 1),
            "blockage": round(float(blockages.iloc[i]), 2)
        })

    response_data = {
        "simulation_parameters": {
            "rainfall_24h": sim.rainfall_mm,
            "rainfall_7d": sim.rainfall_7d_sum,
            "blockage_multiplier": sim.blockage_multiplier,
            "model_choice": sim.model_choice
        },
        "summary": {
            "total_cells": n,
            "severe_warning_cells": severe_count,
            "moderate_advisory_cells": moderate_count,
            "low_risk_cells": low_count,
            "severe_pct": f"{(severe_count/n)*100:.1f}%",
            "moderate_pct": f"{(moderate_count/n)*100:.1f}%"
        },
        "grid_predictions": results,
        "disclaimer": DISCLAIMER_TEXT
    }

    # Keep cache bounded to 50 recent simulations
    if len(_simulation_cache) > 50:
        _simulation_cache.pop(next(iter(_simulation_cache)))
    _simulation_cache[cache_key] = response_data

    return response_data

