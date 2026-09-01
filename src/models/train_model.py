import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_sample_weight
import joblib
import logging
import shap
import os
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train(parquet_path="data/processed/master_dataset.parquet", models_dir="models"):
    Path(models_dir).mkdir(parents=True, exist_ok=True)
    import duckdb
    
    logger.info(f"Connecting to DuckDB to sample master dataset from {parquet_path}...")
    con = duckdb.connect()
    
    # 1. Load all positive instances
    df_pos = con.execute(f"""
        SELECT * FROM read_parquet('{parquet_path}') 
        WHERE flood_risk_label > 0
    """).df()
    n_pos = len(df_pos)
    logger.info(f"Loaded {n_pos} positive flood risk instances.")
    
    if n_pos == 0:
        logger.error("No positive labels found in dataset!")
        return
        
    # 2. Load 50x negative sample using DuckDB sample
    logger.info(f"Sampling {n_pos * 50} negative instances directly from parquet...")
    df_neg = con.execute(f"""
        SELECT * FROM read_parquet('{parquet_path}') 
        WHERE flood_risk_label = 0 
        USING SAMPLE {n_pos * 50} ROWS
    """).df()
    
    df_sampled = pd.concat([df_pos, df_neg], ignore_index=True)
    logger.info(f"Sampled training pool shape: {df_sampled.shape}")
    
    # Feature candidate list
    all_candidate_features = [
        "rainfall_mm",
        "rainfall_3d_sum",
        "rainfall_7d_sum",
        "is_rainy_season",
        "elevation_m",
        "slope_deg",
        "impervious_pct",
        "road_density",
        "dist_to_water_m",
        "drain_density",
        "drain_coverage_gap",
        "composite_blockage_risk"
    ]
    features = [f for f in all_candidate_features if f in df_sampled.columns]
    logger.info(f"Using {len(features)} features for training: {features}")
    
    # Clean dataset
    df_sampled = df_sampled.dropna(subset=["flood_risk_label"])
    df_sampled[features] = df_sampled[features].fillna(0)
    
    X = df_sampled[features]
    y = df_sampled["flood_risk_label"].astype(int)
    grid_ids = df_sampled["grid_id"]
    
    from sklearn.model_selection import GroupShuffleSplit
    
    # Strict spatial holdout: GroupShuffleSplit by grid_id
    logger.info("Splitting dataset using GroupShuffleSplit grouped strictly by grid_id (20% spatial holdout)...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=grid_ids))
    
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    grid_train, grid_test = grid_ids.iloc[train_idx], grid_ids.iloc[test_idx]
    
    train_grids = grid_train.nunique()
    test_grids = grid_test.nunique()
    pos_train_grids = grid_train[y_train > 0].nunique()
    pos_test_grids = grid_test[y_test > 0].nunique()
    
    print("\n" + "="*60)
    print(" SPATIAL SPLIT VERIFICATION (GroupShuffleSplit by grid_id)")
    print("="*60)
    print(f"Total Unique Grid Cells:   Train = {train_grids}, Test = {test_grids}")
    print(f"Positive Grid Cells:       Train = {pos_train_grids}, Test = {pos_test_grids}")
    print(f"Overlap between Train/Test Grids: {len(set(grid_train).intersection(set(grid_test)))} (Strict 0 Spatial Leakage)")
    print(f"Train Class Distribution:\n{y_train.value_counts()}")
    print(f"Test Class Distribution:\n{y_test.value_counts()}")
    print("="*60)
    
    print("\n" + "="*60)
    print(" 1. RANDOM FOREST (class_weight='balanced') - UNSEEN GRIDS")
    print("="*60)
    rf_model = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    y_pred_rf = rf_model.predict(X_test)
    print("\n[Random Forest Classification Report on Unseen Grid Cells]:")
    print(classification_report(y_test, y_pred_rf, digits=4))
    
    print("\n" + "="*60)
    print(" 2. XGBOOST (balanced sample_weights) - UNSEEN GRIDS")
    print("="*60)
    sample_weights = compute_sample_weight(class_weight='balanced', y=y_train)
    xgb_model = xgb.XGBClassifier(
        n_estimators=120,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train, sample_weight=sample_weights)
    y_pred_xgb = xgb_model.predict(X_test)
    print("\n[XGBoost Classification Report on Unseen Grid Cells]:")
    print(classification_report(y_test, y_pred_xgb, digits=4))
    
    print("\n" + "="*60)
    print(" 3. TEST SET MEMORIZATION & SPATIAL DIVERSITY CHECK")
    print("="*60)
    test_eval_df = pd.DataFrame({
        "true_label": y_test,
        "pred_rf": y_pred_rf,
        "pred_xgb": y_pred_xgb,
        "grid_id": grid_test
    })
    
    for cls in sorted(y_test.unique()):
        cls_sub = test_eval_df[test_eval_df["true_label"] == cls]
        unique_grids = cls_sub["grid_id"].nunique()
        total_samples = len(cls_sub)
        print(f"\nClass {cls} Test Evaluation:")
        print(f"  - Total Test Instances: {total_samples}")
        print(f"  - Unique Grid Cells:    {unique_grids}")
        
        # Check precision/recall flags
        rf_correct = (cls_sub["pred_rf"] == cls).sum()
        xgb_correct = (cls_sub["pred_xgb"] == cls).sum()
        print(f"  - RF Correct:  {rf_correct}/{total_samples} ({rf_correct/total_samples*100:.1f}%)")
        print(f"  - XGB Correct: {xgb_correct}/{total_samples} ({xgb_correct/total_samples*100:.1f}%)")
        
        if unique_grids < 3 and total_samples > 10:
            print("  --> [ALERT] High risk of spatial memorization! Only very few grid cells represent this class.")
        else:
            print("  --> [OK] Distributed across multiple spatial grid cells.")
            
    print("\n" + "="*60)
    print(" 4. SHAP FEATURE IMPORTANCE ANALYSIS (XGBoost)")
    print("="*60)
    explainer = shap.TreeExplainer(xgb_model)
    # Subsample X_test for fast SHAP computation
    shap_sample = X_test.sample(n=min(len(X_test), 500), random_state=42)
    shap_values = explainer.shap_values(shap_sample)
    
    if isinstance(shap_values, list):  # Multiclass output
        for i, cls_shap in enumerate(shap_values):
            print(f"\n--- SHAP Feature Importance for Class {i} ---")
            vals = np.abs(cls_shap).mean(0)
            imp_df = pd.DataFrame({
                "Feature": X_train.columns,
                "Mean |SHAP Value|": vals,
                "Relative %": (vals / vals.sum()) * 100
            }).sort_values(by="Mean |SHAP Value|", ascending=False)
            print(imp_df.to_string(index=False))
    else:
        vals = np.abs(shap_values).mean(0)
        imp_df = pd.DataFrame({
            "Feature": X_train.columns,
            "Mean |SHAP Value|": vals,
            "Relative %": (vals / vals.sum()) * 100
        }).sort_values(by="Mean |SHAP Value|", ascending=False)
        print(imp_df.to_string(index=False))
        
    print("\n--- Drainage & Blockage Contribution Check ---")
    drain_features = [f for f in ["drain_density", "drain_coverage_gap", "composite_blockage_risk", "blockage_event_count"] if f in X_train.columns]
    for df_feat in drain_features:
        if df_feat in imp_df["Feature"].values:
            rank = list(imp_df["Feature"].values).index(df_feat) + 1
            pct = imp_df.loc[imp_df["Feature"] == df_feat, "Relative %"].values[0]
            print(f"  * {df_feat}: Rank #{rank}/{len(features)} (Relative Importance: {pct:.2f}%)")
            
    # Save models
    joblib.dump(rf_model, f"{models_dir}/rf_baseline.joblib")
    xgb_model.save_model(f"{models_dir}/xgb_baseline.json")
    logger.info(f"Saved models to {models_dir}/")

if __name__ == "__main__":
    train()
