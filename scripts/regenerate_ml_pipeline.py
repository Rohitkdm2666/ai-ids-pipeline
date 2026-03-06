#!/usr/bin/env python3
"""
Regenerate full ML pipeline: feature selection -> top20 dataset -> train model.
Phases 2, 3, 4 in one script.
Outputs: Data/top20_features.json, Data/Processed Data/CICIDS2017_top20.csv,
         ml-service/model/model.pkl, scaler.pkl, top20_features.json
"""

import json
import logging
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s", stream=sys.stdout)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
ORIGINAL_CSV = PROJECT_ROOT / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
TOP20_JSON = PROJECT_ROOT / "Data" / "top20_features.json"
TOP20_CSV = PROJECT_ROOT / "Data" / "Processed Data" / "CICIDS2017_top20.csv"
ML_MODEL_DIR = PROJECT_ROOT / "ml-service" / "model"


def main():
    # Phase 2: Feature selection
    logger.info("=== Phase 2: Feature Selection ===")
    df = pd.read_csv(ORIGINAL_CSV)
    X = df.drop("Label", axis=1)
    y = df["Label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    scaler_temp = StandardScaler()
    X_train_s = scaler_temp.fit_transform(X_train)

    rf_temp = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf_temp.fit(X_train_s, y_train)

    importances = pd.Series(rf_temp.feature_importances_, index=X.columns)
    top20 = importances.sort_values(ascending=False).head(20).index.tolist()

    TOP20_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(TOP20_JSON, "w") as f:
        json.dump(top20, f, indent=2)
    logger.info("Saved top 20 features to %s", TOP20_JSON)

    # Phase 3: Create top-20 dataset
    logger.info("=== Phase 3: Create CICIDS2017_top20.csv ===")
    df_top20 = df[top20 + ["Label"]]
    TOP20_CSV.parent.mkdir(parents=True, exist_ok=True)
    df_top20.to_csv(TOP20_CSV, index=False)
    logger.info("Saved %s: shape %s (rows x 21 cols)", TOP20_CSV, df_top20.shape)

    # Phase 4: Train model
    logger.info("=== Phase 4: Train Model ===")
    X = df_top20.drop("Label", axis=1)
    y = df_top20["Label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train_scaled, y_train)

    y_pred = rf.predict(X_test_scaled)
    logger.info("Accuracy:  %.4f", accuracy_score(y_test, y_pred))
    logger.info("Precision: %.4f", precision_score(y_test, y_pred, average="binary", zero_division=0))
    logger.info("Recall:    %.4f", recall_score(y_test, y_pred, average="binary", zero_division=0))
    logger.info("F1 Score:  %.4f", f1_score(y_test, y_pred, average="binary", zero_division=0))
    logger.info("Confusion Matrix:\n%s", confusion_matrix(y_test, y_pred))
    logger.info("\nClassification Report:\n%s", classification_report(y_test, y_pred))

    ML_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf, ML_MODEL_DIR / "model.pkl")
    joblib.dump(scaler, ML_MODEL_DIR / "scaler.pkl")
    with open(ML_MODEL_DIR / "top20_features.json", "w") as f:
        json.dump(top20, f, indent=2)

    logger.info("Saved to %s: model.pkl, scaler.pkl, top20_features.json", ML_MODEL_DIR)


if __name__ == "__main__":
    main()
