#!/usr/bin/env python3
"""
Phase 2: Select Top 20 Features from CICIDS2017 using RandomForest feature importance.
Outputs: Data/top20_features.json
"""

import json
import logging
import sys
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# Project paths
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
DATASET_PATH = PROJECT_ROOT / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
OUTPUT_PATH = PROJECT_ROOT / "Data" / "top20_features.json"


def main():
    logger.info("Loading CICIDS2017_Processed.csv...")
    df = pd.read_csv(DATASET_PATH)
    logger.info(f"Dataset shape: {df.shape}")

    X = df.drop("Label", axis=1)
    y = df["Label"]
    logger.info(f"Features: {X.shape[1]}, Samples: {len(X)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    logger.info("Training temporary RandomForestClassifier...")
    rf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_scaled, y_train)

    importances = rf.feature_importances_
    feat_series = pd.Series(importances, index=X.columns)
    top20 = feat_series.sort_values(ascending=False).head(20)

    logger.info("\n" + "=" * 60)
    logger.info("TOP 20 FEATURES (by importance)")
    logger.info("=" * 60)
    for rank, (feat, imp) in enumerate(top20.items(), start=1):
        logger.info(f"  {rank:2d}. {feat}: {imp:.6f}")
    logger.info("=" * 60)

    top20_list = top20.index.tolist()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(top20_list, f, indent=2)

    logger.info(f"\nSaved to: {OUTPUT_PATH}")
    return top20_list


if __name__ == "__main__":
    main()
