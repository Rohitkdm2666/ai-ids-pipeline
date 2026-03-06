#!/usr/bin/env python3
"""
Phase 3: Train RandomForest using ONLY top 20 features.
Saves: ids_random_forest_model.pkl, scaler.pkl, top20_features.pkl
"""

import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
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

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
DATASET_PATH = PROJECT_ROOT / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
TOP20_PATH = PROJECT_ROOT / "Data" / "top20_features.json"
MODELS_DIR = PROJECT_ROOT / "Trained Models" / "Models"


def main():
    logger.info("Loading top 20 features from %s", TOP20_PATH)
    with open(TOP20_PATH) as f:
        top20_features = json.load(f)
    logger.info("Top 20 features: %s", top20_features)

    logger.info("Loading CICIDS2017_Processed.csv...")
    df = pd.read_csv(DATASET_PATH)

    X = df[top20_features]
    y = df["Label"]
    logger.info("X shape: %s, y shape: %s", X.shape, y.shape)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    logger.info("Training RandomForest...")
    rf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_scaled, y_train)

    y_pred = rf.predict(X_test_scaled)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average="binary", zero_division=0)
    recall = recall_score(y_test, y_pred, average="binary", zero_division=0)
    f1 = f1_score(y_test, y_pred, average="binary", zero_division=0)

    logger.info("\n" + "=" * 50)
    logger.info("MODEL PERFORMANCE METRICS")
    logger.info("=" * 50)
    logger.info("Accuracy:  %.4f", accuracy)
    logger.info("Precision: %.4f", precision)
    logger.info("Recall:    %.4f", recall)
    logger.info("F1 Score:  %.4f", f1)
    logger.info("=" * 50)
    logger.info("\nClassification Report:\n%s", classification_report(y_test, y_pred))
    logger.info("Confusion Matrix:\n%s", confusion_matrix(y_test, y_pred))

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf, MODELS_DIR / "ids_random_forest_model.pkl")
    joblib.dump(scaler, MODELS_DIR / "scaler.pkl")
    joblib.dump(top20_features, MODELS_DIR / "top20_features.pkl")

    logger.info("\nSaved artifacts to %s:", MODELS_DIR)
    logger.info("  - ids_random_forest_model.pkl")
    logger.info("  - scaler.pkl")
    logger.info("  - top20_features.pkl")


if __name__ == "__main__":
    main()
