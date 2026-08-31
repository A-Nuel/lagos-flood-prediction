"""
build_features.py
-----------------
Engineers model-ready features from the master dataset.

Input:  data/processed/master_dataset.parquet
Output: data/processed/features.parquet  (X matrix)
        data/processed/labels.parquet    (y vector)

Features engineered here:
  Temporal:
    - rainfall_3d_sum, rainfall_7d_sum   (already in master, validated here)
    - rainfall_intensity_class           (none / light / moderate / heavy / extreme)
    - days_since_last_rain               (dry spell length — longer dry spell → harder
                                          surface → more runoff when rain hits)
    - is_rainy_season                    (April–October Lagos)

  Terrain:
    - elevation_percentile               (how low this cell is relative to Lagos overall)
    - slope_class                        (flat / gentle / moderate / steep)
    - low_lying_flag                     (elevation < 5m AND slope < 2°)

  Infrastructure:
    - infra_vulnerability_score          (combined: high impervious + low drain density
                                          + high blockage risk)

  Interaction terms:
    - rain_x_blockage                    (rainfall_7d_sum × composite_blockage_risk)
    - rain_x_low_lying                   (rainfall_7d_sum × low_lying_flag)
    - blockage_x_impervious              (composite_blockage_risk × impervious_pct)
"""

import numpy as np
import pandas as pd
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Main feature engineering function.
    Takes the master dataset DataFrame and returns an enriched version
    with all derived features added.
    """
    df = df.copy()
    logger.info(f"Engineering features for {len(df):,} rows...")

    # ── Temporal features ─────────────────────────────────

    # Rainfall intensity class (CHIRPS daily mm thresholds)
    df["rainfall_intensity_class"] = pd.cut(
        df["rainfall_mm"].fillna(0),
        bins=[-1, 0, 10, 25, 50, float("inf")],
        labels=[0, 1, 2, 3, 4]   # none, light, moderate, heavy, extreme
    ).astype(int)

    # Days since last meaningful rain (>1mm) per grid cell
    # Longer dry spells → soil crusting → higher runoff when rain arrives
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values(["grid_id", "date"])

        def days_since_rain(series, threshold=1.0):
            result = np.zeros(len(series))
            counter = 0
            for i, val in enumerate(series):
                if val >= threshold:
                    counter = 0
                else:
                    counter += 1
                result[i] = counter
            return result

        df["days_since_last_rain"] = (
            df.groupby("grid_id")["rainfall_mm"]
            .transform(lambda x: days_since_rain(x.fillna(0).values))
        )
    else:
        df["days_since_last_rain"] = np.nan

    # ── Terrain features ──────────────────────────────────

    # Elevation percentile within Lagos (low percentile = flood-prone low ground)
    if "elevation_m" in df.columns and df["elevation_m"].notna().any():
        elev_unique = df.groupby("grid_id")["elevation_m"].first()
        pct_map = elev_unique.rank(pct=True).to_dict()
        df["elevation_percentile"] = df["grid_id"].map(pct_map)
    else:
        df["elevation_percentile"] = np.nan

    # Slope class
    if "slope_deg" in df.columns:
        df["slope_class"] = pd.cut(
            df["slope_deg"].fillna(0),
            bins=[-1, 2, 5, 15, float("inf")],
            labels=[0, 1, 2, 3]   # flat, gentle, moderate, steep
        ).astype(int)
    else:
        df["slope_class"] = np.nan

    # Low-lying flag: elevation < 5m AND nearly flat — highest flood susceptibility
    elev_ok  = df.get("elevation_m",  pd.Series(np.nan, index=df.index)).fillna(999)
    slope_ok = df.get("slope_deg",    pd.Series(np.nan, index=df.index)).fillna(999)
    df["low_lying_flag"] = ((elev_ok < 5.0) & (slope_ok < 2.0)).astype(int)

    # ── Infrastructure vulnerability ──────────────────────

    # Normalise components (0–1) and combine into a single vulnerability score
    def safe_norm(s):
        s = s.fillna(0)
        rng = s.max() - s.min()
        return (s - s.min()) / rng if rng > 0 else pd.Series(0.0, index=s.index)

    imp  = safe_norm(df.get("impervious_pct",         pd.Series(0, index=df.index)))
    blk  = safe_norm(df.get("composite_blockage_risk", pd.Series(0, index=df.index)))
    # Invert drain density: low density = more vulnerable
    drd  = 1.0 - safe_norm(df.get("drain_density",    pd.Series(0, index=df.index)))

    df["infra_vulnerability_score"] = (0.4 * imp) + (0.4 * blk) + (0.2 * drd)

    # ── Interaction terms ─────────────────────────────────

    rain7 = df.get("rainfall_7d_sum", pd.Series(0, index=df.index)).fillna(0)
    blk_r = df.get("composite_blockage_risk", pd.Series(0, index=df.index)).fillna(0)
    imp_r = df.get("impervious_pct", pd.Series(0, index=df.index)).fillna(0)
    llf   = df.get("low_lying_flag", pd.Series(0, index=df.index)).fillna(0)

    df["rain_x_blockage"]    = rain7 * blk_r
    df["rain_x_low_lying"]   = rain7 * llf
    df["blockage_x_impervious"] = blk_r * imp_r

    logger.info("Feature engineering complete.")
    logger.info(f"  Total features: {len(df.columns)} columns")
    return df


def get_feature_columns() -> list:
    """Returns the ordered list of feature columns used for model training."""
    return [
        # Rainfall
        "rainfall_mm", "rainfall_3d_sum", "rainfall_7d_sum",
        "rainfall_intensity_class", "days_since_last_rain", "is_rainy_season",
        # Terrain
        "elevation_m", "slope_deg", "elevation_percentile",
        "slope_class", "low_lying_flag",
        # Land use
        "impervious_pct",
        # Infrastructure
        "road_density", "dist_to_water_m",
        # Drainage / blockage
        "drain_density", "drain_coverage_gap",
        "n_waste_sites_nearby", "n_markets_nearby",
        "blockage_event_count", "composite_blockage_risk",
        # Composite scores
        "infra_vulnerability_score",
        # Interactions
        "rain_x_blockage", "rain_x_low_lying", "blockage_x_impervious",
    ]


def prepare_model_inputs(
    master_path: str = "data/processed/master_dataset.parquet",
    output_dir: str = "data/processed/"
) -> tuple:
    """
    Loads master dataset, engineers all features, and splits into X and y.
    Saves features.parquet and labels.parquet.

    Returns: (X: pd.DataFrame, y: pd.Series)
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(master_path)
    df = engineer_features(df)

    feature_cols = [c for c in get_feature_columns() if c in df.columns]
    missing = [c for c in get_feature_columns() if c not in df.columns]
    if missing:
        logger.warning(f"Missing feature columns (will be excluded): {missing}")

    X = df[feature_cols].copy()
    y = df["flood_risk_label"].copy() if "flood_risk_label" in df.columns else None

    X.to_parquet(f"{output_dir}/features.parquet", index=False)
    if y is not None:
        y.to_frame().to_parquet(f"{output_dir}/labels.parquet", index=False)

    logger.info(f"X shape: {X.shape} | y shape: {y.shape if y is not None else 'None'}")
    logger.info(f"Saved to {output_dir}")
    return X, y


if __name__ == "__main__":
    # Smoke test with synthetic data
    logger.info("=== build_features smoke test ===")
    np.random.seed(42)
    n = 200
    synthetic = pd.DataFrame({
        "grid_id":               [f"LG_{i:06d}" for i in np.repeat(range(20), 10)],
        "date":                  pd.date_range("2023-06-01", periods=10).tolist() * 20,
        "rainfall_mm":           np.random.exponential(5, n),
        "rainfall_3d_sum":       np.random.exponential(12, n),
        "rainfall_7d_sum":       np.random.exponential(28, n),
        "is_rainy_season":       np.random.randint(0, 2, n),
        "elevation_m":           np.random.uniform(0, 20, n),
        "slope_deg":             np.random.uniform(0, 10, n),
        "impervious_pct":        np.random.uniform(0, 1, n),
        "road_density":          np.random.uniform(0, 0.01, n),
        "dist_to_water_m":       np.random.uniform(50, 2000, n),
        "drain_density":         np.random.uniform(0, 0.005, n),
        "drain_coverage_gap":    np.random.randint(0, 2, n),
        "n_waste_sites_nearby":  np.random.randint(0, 5, n),
        "n_markets_nearby":      np.random.randint(0, 3, n),
        "blockage_event_count":  np.random.randint(0, 4, n),
        "composite_blockage_risk": np.random.uniform(0, 1, n),
        "flood_risk_label":      np.random.randint(0, 4, n),
    })

    result = engineer_features(synthetic)
    new_cols = ["rainfall_intensity_class", "days_since_last_rain",
                "elevation_percentile", "slope_class", "low_lying_flag",
                "infra_vulnerability_score", "rain_x_blockage",
                "rain_x_low_lying", "blockage_x_impervious"]
    print(result[new_cols].describe().round(3))
    print(f"\nAll {len(result.columns)} columns present. Smoke test passed.")
