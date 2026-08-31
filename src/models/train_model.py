import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train():
    logger.info("Loading master dataset...")
    df = pd.read_parquet("data/processed/master_dataset.parquet")
    
    logger.info(f"Dataset shape: {df.shape}")
    
    # Drop rows with NaN in features
    features = ["rainfall_3d_sum", "rainfall_7d_sum", "road_density", "drain_density", "composite_blockage_risk"]
    
    # For now, drop rows where features are NaN. (If static features like road_density are NaN because Geofabrik isn't loaded, we'll fill with 0)
    df = df.dropna(subset=["flood_risk_label"])
    df[features] = df[features].fillna(0)
    
    # Downsample the majority class (0) so it's not 24 million rows
    logger.info("Downsampling majority class...")
    df_pos = df[df["flood_risk_label"] > 0]
    df_neg = df[df["flood_risk_label"] == 0].sample(n=len(df_pos) * 10, random_state=42)
    df_downsampled = pd.concat([df_pos, df_neg])
    logger.info(f"Downsampled dataset shape: {df_downsampled.shape}")
    
    X = df_downsampled[features]
    y = df_downsampled["flood_risk_label"].astype(int)
    
    logger.info(f"Class distribution before splitting:\n{y.value_counts()}")
    
    if len(y.unique()) < 2:
        logger.error("Only 1 class found in labels! Cannot train model. (Need both Low and Medium/High risk)")
        return
        
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    logger.info("Training Logistic Regression with class_weight='balanced'...")
    lr_model = LogisticRegression(class_weight="balanced", max_iter=1000)
    lr_model.fit(X_train, y_train)
    
    logger.info("Training Random Forest with class_weight='balanced'...")
    rf_model = RandomForestClassifier(n_estimators=50, class_weight="balanced", random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    
    # Evaluate
    logger.info("--- Logistic Regression Evaluation ---")
    y_pred_lr = lr_model.predict(X_test)
    logger.info(f"\n{classification_report(y_test, y_pred_lr)}")
    logger.info(f"Confusion Matrix:\n{confusion_matrix(y_test, y_pred_lr)}")
    
    logger.info("--- Random Forest Evaluation ---")
    y_pred_rf = rf_model.predict(X_test)
    logger.info(f"\n{classification_report(y_test, y_pred_rf)}")
    logger.info(f"Confusion Matrix:\n{confusion_matrix(y_test, y_pred_rf)}")
    
    # Save models
    joblib.dump(lr_model, "models/lr_baseline.joblib")
    joblib.dump(rf_model, "models/rf_baseline.joblib")
    logger.info("Models saved to models/ directory.")

if __name__ == "__main__":
    train()
