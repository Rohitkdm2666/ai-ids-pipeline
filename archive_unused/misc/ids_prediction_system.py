# ==========================================
# Intrusion Detection - Prediction System
# Phase 1: Attack Detection Engine
# Uses top 20 features from Data/top20_features.json
# ==========================================

import json
import pandas as pd
import joblib
from pathlib import Path

# ------------------------------------------
# 1. Load Model, Scaler & Top 20 Features
# ------------------------------------------
print("\nLoading IDS model...")

script_dir = Path(__file__).parent
project_root = script_dir.parent
model_path = project_root / "Trained Models" / "Models" / "ids_random_forest_model.pkl"
scaler_path = project_root / "Trained Models" / "Models" / "scaler.pkl"
top20_path = project_root / "Data" / "top20_features.json"

model = joblib.load(model_path)
scaler = joblib.load(scaler_path)
with open(top20_path) as f:
    FEATURE_COLUMNS = json.load(f)

print("Model, scaler & top 20 features loaded successfully.")


# ------------------------------------------
# 2. Function: Predict Single Flow
# ------------------------------------------
def predict_flow(flow_data):
    row = {col: float(flow_data.get(col, 0)) for col in FEATURE_COLUMNS}
    flow_df = pd.DataFrame([row], columns=FEATURE_COLUMNS)
    flow_scaled = scaler.transform(flow_df)
    prediction = model.predict(flow_scaled)[0]
    probability = model.predict_proba(flow_scaled)[0][1]
    result = "ATTACK DETECTED" if prediction == 1 else "NORMAL TRAFFIC"
    return result, probability


# ------------------------------------------
# 3. Predict from Dataset Row (Real Test)
# ------------------------------------------
print("\nRunning sample prediction from dataset...\n")

dataset_path = project_root / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
df = pd.read_csv(dataset_path)

# Use only top 20 features
test_flow = df[FEATURE_COLUMNS].iloc[0].to_dict()

result, prob = predict_flow(test_flow)

print(f"Prediction Result: {result}")
print(f"Attack Probability: {prob:.4f}")