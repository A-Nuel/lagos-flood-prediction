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
# SMOKE TEST
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    from src.features.build_features import engineer_features, get_feature_columns
    from src.models.train_model import (
        train_baseline, train_random_forest,
        train_xgboost, compute_class_weights
    )

    logger.info("=== evaluate smoke test ===")
    np.random.seed(42)
    n = 600
    raw = pd.DataFrame({
        "grid_id": [f"LG_{i:06d}" for i in np.repeat(range(60), 10)],
        "date": pd.date_range("2020-01-01", periods=10).tolist() * 60,
        **{col: np.random.uniform(0, 1, n) for col in [
            "rainfall_mm","rainfall_3d_sum","rainfall_7d_sum","is_rainy_season",
            "elevation_m","slope_deg","impervious_pct","road_density",
            "dist_to_water_m","drain_density","drain_coverage_gap",
            "n_waste_sites_nearby","n_markets_nearby",
            "blockage_event_count","composite_blockage_risk",
        ]},
        "flood_risk_label": np.random.choice([0,1,2,3], n, p=[0.65,0.2,0.1,0.05]),
    })
    raw["elevation_m"] *= 20
    raw["dist_to_water_m"] *= 2000
    raw["slope_deg"] *= 15

    featured  = engineer_features(raw)
    feat_cols = [c for c in get_feature_columns() if c in featured.columns]
    X = featured[feat_cols]
    y = featured["flood_risk_label"]

    split = int(len(X) * 0.8)
    X_tr, X_te = X.iloc[:split], X.iloc[split:]
    y_tr, y_te = y.iloc[:split], y.iloc[split:]

    cw  = compute_class_weights(y_tr)
    lr  = train_baseline(X_tr, y_tr)
    rf  = train_random_forest(X_tr, y_tr, n_estimators=50)
    xgb = train_xgboost(X_tr, y_tr, cw)

    xgb_bundle = joblib.load(MODELS_DIR / "xgboost.pkl")
    evaluate_model(lr,  X_te, y_te, "Logistic Regression")
    evaluate_model(rf,  X_te, y_te, "Random Forest")
    evaluate_model(xgb_bundle, X_te, y_te, "XGBoost")
    shap_feature_importance(xgb_bundle, X_te, top_n=10, sample_n=100)
    compare_models(X_te, y_te)
    print("\nEvaluate smoke test passed.")
