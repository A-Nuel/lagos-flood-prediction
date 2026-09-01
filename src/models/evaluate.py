"""
evaluate.py
-----------
Model evaluation: confusion matrix, per-class F1, SHAP feature importance.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import logging
import joblib
from pathlib import Path
from sklearn.metrics import (
    classification_report, confusion_matrix,
    f1_score, ConfusionMatrixDisplay
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RISK_LABELS  = ["Low", "Medium", "High", "Critical"]
MODELS_DIR   = Path("models")
REPORTS_DIR  = Path("reports/figures")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────
# CLASSIFICATION REPORT
# ─────────────────────────────────────────────────────────

def evaluate_model(model, X_test: pd.DataFrame, y_test: pd.Series, model_name: str = "model") -> dict:
    """Full evaluation: report + confusion matrix + saved figure."""
    logger.info(f"\n{'='*50}")
    logger.info(f"Evaluating: {model_name}")

    # Handle XGBoost dict format (saved with imputer)
    if isinstance(model, dict):
        X_input = pd.DataFrame(model["imputer"].transform(X_test), columns=X_test.columns)
        clf = model["model"]
        y_pred = clf.predict(X_input)
    else:
        y_pred = model.predict(X_test)

    report = classification_report(y_test, y_pred, target_names=RISK_LABELS, output_dict=True)
    print(classification_report(y_test, y_pred, target_names=RISK_LABELS))

    macro_f1    = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")
    logger.info(f"Macro F1: {macro_f1:.3f}  |  Weighted F1: {weighted_f1:.3f}")

    # Confusion matrix plot
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(7, 6))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=RISK_LABELS)
    disp.plot(ax=ax, colorbar=True, cmap="Blues")
    ax.set_title(f"Confusion Matrix — {model_name}", fontsize=13, fontweight="bold")
    plt.tight_layout()
    out_path = REPORTS_DIR / f"confusion_{model_name.lower().replace(' ', '_')}.png"
    plt.savefig(out_path, dpi=150)
    plt.close()
    logger.info(f"Confusion matrix saved → {out_path}")

    return {
        "model_name": model_name,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "report": report,
    }


# ─────────────────────────────────────────────────────────
# SHAP FEATURE IMPORTANCE
# ─────────────────────────────────────────────────────────

def shap_feature_importance(
    xgb_bundle: dict,
    X_test: pd.DataFrame,
    top_n: int = 15,
    sample_n: int = 500
) -> pd.DataFrame:
    """
    Computes SHAP values for the XGBoost model and plots mean absolute
    SHAP importance per feature (averaged across all risk classes).

    xgb_bundle: dict with keys 'model' (XGBClassifier) and 'imputer'
    Returns a DataFrame of feature importances sorted descending.
    """
    try:
        import shap
    except ImportError:
        logger.error("shap not installed. Run: pip install shap")
        return pd.DataFrame()

    logger.info("Computing SHAP values (this may take a minute)...")

    clf     = xgb_bundle["model"]
    imputer = xgb_bundle["imputer"]

    # Impute and subsample for speed
    X_imp = pd.DataFrame(imputer.transform(X_test), columns=X_test.columns)
    if len(X_imp) > sample_n:
        X_imp = X_imp.sample(sample_n, random_state=42)

    explainer   = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_imp)
    # shap_values shape varies by version:
    # older: list of (n_samples, n_features) arrays, one per class
    # newer: single (n_samples, n_features, n_classes) array
    if isinstance(shap_values, list):
        mean_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
    else:
        # 3D array: (n_samples, n_features, n_classes)
        mean_shap = np.abs(shap_values).mean(axis=(0, 2))

    importance_df = pd.DataFrame({
        "feature":         list(X_imp.columns),
        "shap_importance": list(mean_shap),
    }).sort_values("shap_importance", ascending=False).reset_index(drop=True)

    # Plot
    top = importance_df.head(top_n)
    colors = ["#e63946" if "blockage" in f or "drain" in f or "waste" in f or "market" in f
              else "#457b9d"
              for f in top["feature"]]

    fig, ax = plt.subplots(figsize=(9, 6))
    bars = ax.barh(top["feature"][::-1], top["shap_importance"][::-1], color=colors[::-1])
    ax.set_xlabel("Mean |SHAP value| (impact on flood risk prediction)", fontsize=11)
    ax.set_title("Feature Importance — XGBoost (SHAP)\nRed = drainage/blockage features",
                 fontsize=13, fontweight="bold")
    ax.axvline(0, color="black", linewidth=0.8)
    plt.tight_layout()
    out_path = REPORTS_DIR / "shap_importance_xgboost.png"
    plt.savefig(out_path, dpi=150)
    plt.close()
    logger.info(f"SHAP importance plot saved → {out_path}")

    logger.info("\nTop 10 most important features:")
    print(importance_df.head(10).to_string(index=False))
    return importance_df


# ─────────────────────────────────────────────────────────
# COMPARE ALL MODELS
# ─────────────────────────────────────────────────────────

def compare_models(
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> pd.DataFrame:
    """
    Loads all saved models and compares their macro F1 on the test set.
    Returns a summary DataFrame.
    """
    results = []
    model_files = {
        "Logistic Regression": MODELS_DIR / "logistic_regression.pkl",
        "Random Forest":       MODELS_DIR / "random_forest.pkl",
        "XGBoost":             MODELS_DIR / "xgboost.pkl",
    }

    for name, path in model_files.items():
        if not path.exists():
            logger.warning(f"{name} model not found at {path}. Skipping.")
            continue
        model = joblib.load(path)
        res   = evaluate_model(model, X_test, y_test, model_name=name)
        results.append(res)

    if not results:
        logger.error("No models found. Run train_model.py first.")
        return pd.DataFrame()

    summary = pd.DataFrame([{
        "Model":       r["model_name"],
        "Macro F1":    round(r["macro_f1"], 3),
        "Weighted F1": round(r["weighted_f1"], 3),
    } for r in results]).sort_values("Macro F1", ascending=False)

    logger.info("\n=== Model Comparison ===")
    print(summary.to_string(index=False))

    # Bar chart comparison
    fig, ax = plt.subplots(figsize=(8, 4))
    x = np.arange(len(summary))
    ax.bar(x - 0.2, summary["Macro F1"],    0.35, label="Macro F1",    color="#2a9d8f")
    ax.bar(x + 0.2, summary["Weighted F1"], 0.35, label="Weighted F1", color="#e9c46a")
    ax.set_xticks(x)
    ax.set_xticklabels(summary["Model"], fontsize=11)
    ax.set_ylim(0, 1)
    ax.set_ylabel("F1 Score")
    ax.set_title("Model Comparison — Lagos Flood Risk Classifier", fontsize=13, fontweight="bold")
    ax.legend()
    ax.axhline(0.5, color="red", linestyle="--", linewidth=0.8, alpha=0.5, label="0.5 baseline")
    plt.tight_layout()
    out_path = REPORTS_DIR / "model_comparison.png"
    plt.savefig(out_path, dpi=150)
    plt.close()
    logger.info(f"Comparison chart saved → {out_path}")
    return summary


# ─────────────────────────────────────────────────────────
# THRESHOLD TUNING & PRECISION-RECALL TRADEOFF ANALYSIS
# ─────────────────────────────────────────────────────────

def evaluate_threshold_tradeoffs():
    import duckdb
    from sklearn.model_selection import GroupKFold
    import xgboost as xgb
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import (
        precision_score, recall_score, f1_score,
        confusion_matrix, roc_auc_score, average_precision_score
    )
    from sklearn.utils.class_weight import compute_sample_weight

    parquet_path = "data/processed/master_dataset.parquet"
    logger.info(f"Loading deterministic dataset via DuckDB from {parquet_path}...")
    con = duckdb.connect()
    
    # 1. Load all positive instances (all 499 rows)
    df_pos = con.execute(f"SELECT * FROM read_parquet('{parquet_path}') WHERE flood_risk_label > 0").df()
    n_pos = len(df_pos)
    
    # 2. Deterministic negative sample using reproducible ORDER BY hash / seed
    df_neg = con.execute(f"""
        SELECT * FROM read_parquet('{parquet_path}') 
        WHERE flood_risk_label = 0 
        ORDER BY hash(grid_id, date) 
        LIMIT {n_pos * 50}
    """).df()
    df_sampled = pd.concat([df_pos, df_neg], ignore_index=True)
    
    features = [
        "rainfall_mm", "rainfall_3d_sum", "rainfall_7d_sum", "is_rainy_season",
        "elevation_m", "slope_deg", "impervious_pct", "road_density",
        "dist_to_water_m", "drain_density", "drain_coverage_gap", "composite_blockage_risk"
    ]
    df_sampled[features] = df_sampled[features].fillna(0)
    
    X = df_sampled[features]
    y = df_sampled["flood_risk_label"].astype(int)
    grid_ids = df_sampled["grid_id"]
    
    logger.info(f"Running 5-Fold Spatial GroupKFold CV across {grid_ids.nunique()} unique grid cells...")
    gkf = GroupKFold(n_splits=5)
    
    oof_xgb_probs = np.zeros(len(y))
    oof_rf_probs = np.zeros(len(y))
    
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=grid_ids)):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]
        
        sw = compute_sample_weight(class_weight='balanced', y=y_tr)
        xgb_clf = xgb.XGBClassifier(
            n_estimators=120, max_depth=6, learning_rate=0.08,
            subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1
        )
        xgb_clf.fit(X_tr, y_tr, sample_weight=sw)
        oof_xgb_probs[val_idx] = xgb_clf.predict_proba(X_val)[:, 1]
        
        rf_clf = RandomForestClassifier(
            n_estimators=100, class_weight="balanced", max_depth=10, random_state=42, n_jobs=-1
        )
        rf_clf.fit(X_tr, y_tr)
        oof_rf_probs[val_idx] = rf_clf.predict_proba(X_val)[:, 1]
        
    total_pos = (y == 1).sum()
    total_neg = (y == 0).sum()
    
    print("\n" + "="*95)
    print(f" 5-FOLD OUT-OF-FOLD SPATIAL CROSS-VALIDATION (100% of spatial cells tested on unseen models)")
    print(f" Total Samples = {len(y)} | True Flood Events = {total_pos} | Non-Floods = {total_neg}")
    print(f" XGBoost 5-Fold OOF ROC-AUC: {roc_auc_score(y, oof_xgb_probs):.4f} | PR-AUC: {average_precision_score(y, oof_xgb_probs):.4f}")
    print(f" Random Forest 5-Fold OOF ROC-AUC: {roc_auc_score(y, oof_rf_probs):.4f} | PR-AUC: {average_precision_score(y, oof_rf_probs):.4f}")
    print("="*95)
    
    thresholds = [0.50, 0.45, 0.40, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05]
    results = []
    
    for t in thresholds:
        preds = (oof_xgb_probs >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y, preds).ravel()
        p = precision_score(y, preds, zero_division=0)
        r = recall_score(y, preds, zero_division=0)
        f1 = f1_score(y, preds, zero_division=0)
        results.append({
            "Model": "XGBoost",
            "Threshold": f"{t:.2f}",
            "Precision": f"{p*100:.2f}%",
            "Recall": f"{r*100:.2f}%",
            "F1-Score": f"{f1:.4f}",
            "Caught (TP)": tp,
            "Missed (FN)": fn,
            "False Alarm (FP)": fp,
            "Clean (TN)": tn
        })
        
    for t in [0.50, 0.40, 0.35, 0.30, 0.20, 0.10]:
        rf_preds = (oof_rf_probs >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y, rf_preds).ravel()
        p_rf = precision_score(y, rf_preds, zero_division=0)
        r_rf = recall_score(y, rf_preds, zero_division=0)
        f1_rf = f1_score(y, rf_preds, zero_division=0)
        results.append({
            "Model": "Random Forest",
            "Threshold": f"{t:.2f}",
            "Precision": f"{p_rf*100:.2f}%",
            "Recall": f"{r_rf*100:.2f}%",
            "F1-Score": f"{f1_rf:.4f}",
            "Caught (TP)": tp,
            "Missed (FN)": fn,
            "False Alarm (FP)": fp,
            "Clean (TN)": tn
        })
        
    res_df = pd.DataFrame(results)
    print("\n" + res_df.to_string(index=False))
    print("\n" + "="*95)

if __name__ == "__main__":
    evaluate_threshold_tradeoffs()
