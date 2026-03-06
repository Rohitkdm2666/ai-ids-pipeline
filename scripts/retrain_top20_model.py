#!/usr/bin/env python3
"""
Retrain ML model on top-20 CICIDS2017 features.
Loads Data/top20_features.json and Data/Processed Data/CICIDS2017_Processed.csv,
creates top-20 subset, trains RandomForest, saves to ml-service/model/.
"""

import json
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

PROJECT_ROOT = Path(__file__).parent.parent
ORIGINAL_CSV = PROJECT_ROOT / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
TOP20_JSON = PROJECT_ROOT / "Data" / "top20_features.json"
ML_MODEL_DIR = PROJECT_ROOT / "ml-service" / "model"


def main():
    print("[RETRAIN] Loading dataset and top-20 features...")
    df = pd.read_csv(ORIGINAL_CSV)
    with open(TOP20_JSON) as f:
        top20 = json.load(f)

    # Ensure all top20 columns exist
    missing = [c for c in top20 if c not in df.columns]
    if missing:
        print(f"[RETRAIN] ERROR: Missing columns in dataset: {missing}")
        sys.exit(1)
    if "Label" not in df.columns:
        print("[RETRAIN] ERROR: Dataset has no 'Label' column")
        sys.exit(1)

    X = df[top20]
    y = df["Label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("[RETRAIN] Training RandomForestClassifier...")
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train_scaled, y_train)

    y_pred = rf.predict(X_test_scaled)

    print("\n[RETRAIN] === Metrics ===")
    print(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred, average='binary', zero_division=0):.4f}")
    print(f"Recall:    {recall_score(y_test, y_pred, average='binary', zero_division=0):.4f}")
    print(f"F1 Score:  {f1_score(y_test, y_pred, average='binary', zero_division=0):.4f}")
    print(f"\nConfusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
    print(f"\nClassification Report:\n{classification_report(y_test, y_pred)}")

    ML_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(rf, ML_MODEL_DIR / "model.pkl")
    joblib.dump(scaler, ML_MODEL_DIR / "scaler.pkl")
    with open(ML_MODEL_DIR / "top20_features.json", "w") as f:
        json.dump(top20, f, indent=2)

    print(f"\n[RETRAIN] Saved to {ML_MODEL_DIR}: model.pkl, scaler.pkl, top20_features.json")


if __name__ == "__main__":
    main()
