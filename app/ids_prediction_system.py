# ==========================================
# Intrusion Detection - Prediction System
# Phase 1: Attack Detection Engine
# ==========================================

import pandas as pd
import joblib
from pathlib import Path

# ------------------------------------------
# 1. Load Model & Scaler
# ------------------------------------------
print("\nLoading IDS model...")

# Construct paths using pathlib for cross-platform compatibility
script_dir = Path(__file__).parent
project_root = script_dir.parent
model_path = project_root / "Trained Models" / "Models" / "ids_random_forest_model.pkl"
scaler_path = project_root / "Trained Models" / "Models" / "scaler.pkl"

model = joblib.load(model_path)
scaler = joblib.load(scaler_path)

print("Model & scaler loaded successfully.")


# ------------------------------------------
# 2. Function: Predict Single Flow
# ------------------------------------------
def predict_flow(flow_data):

    # Convert to DataFrame
    flow_df = pd.DataFrame([flow_data])

    # Scale features
    flow_scaled = scaler.transform(flow_df)

    # Predict
    prediction = model.predict(flow_scaled)[0]
    probability = model.predict_proba(flow_scaled)[0][1]

    # Result
    if prediction == 1:
        result = "ATTACK DETECTED"
    else:
        result = "NORMAL TRAFFIC"

    return result, probability


# ------------------------------------------
# 3. Example Flow Input (Simulation)
# ------------------------------------------
print("\nRunning sample prediction...\n")

sample_flow = {
    'Destination Port': 80,
    'Flow Duration': 5000,
    'Total Fwd Packets': 10,
    'Total Backward Packets': 8,
    'Total Length of Fwd Packets': 1200,
    'Total Length of Bwd Packets': 900,
    'Flow Bytes/s': 300000,
    'Flow Packets/s': 500,
    # Add remaining features if testing manually
}

# NOTE:
# For full prediction you must supply all 78 features.
# This is just a structural example.


# ------------------------------------------
# 4. Predict from Dataset Row (Real Test)
# ------------------------------------------
dataset_path = project_root / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"
df = pd.read_csv(dataset_path)

X = df.drop("Label", axis=1)

test_flow = X.iloc[0].to_dict()

result, prob = predict_flow(test_flow)

print(f"Prediction Result: {result}")
print(f"Attack Probability: {prob:.4f}")