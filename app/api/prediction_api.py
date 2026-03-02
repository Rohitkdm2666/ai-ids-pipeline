"""
Python ML Prediction API for IDS Platform

Exposes a REST endpoint:
  POST /predict

Request JSON:
  {
    "flow": {
      "<feature_name_1>": <numeric>,
      "...": ...
    }
  }

The feature keys must match the processed CICIDS2017 feature columns
used during training (all columns except 'Label').
"""

from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
  return jsonify({"status": "ok"}), 200


def _load_artifacts():
  """Load trained model, scaler, and feature schema."""
  script_dir = Path(__file__).parent
  project_root = script_dir.parent.parent

  model_path = project_root / "Trained Models" / "Models" / "ids_random_forest_model.pkl"
  scaler_path = project_root / "Trained Models" / "Models" / "scaler.pkl"
  dataset_path = project_root / "Data" / "Processed Data" / "CICIDS2017_Processed.csv"

  model = joblib.load(model_path)
  scaler = joblib.load(scaler_path)

  # Use header from processed dataset to define feature order
  df_header = pd.read_csv(dataset_path, nrows=0)
  feature_columns = [c for c in df_header.columns if c != "Label"]

  return model, scaler, feature_columns


MODEL, SCALER, FEATURE_COLUMNS = _load_artifacts()


def _derive_severity(probability: float) -> str:
  if probability >= 0.9:
    return "critical"
  if probability >= 0.7:
    return "high"
  if probability >= 0.4:
    return "medium"
  return "low"


@app.route("/predict", methods=["POST"])
def predict():
  try:
    payload = request.get_json(silent=True)
    if payload is None:
      return jsonify({"error": "Invalid or missing JSON body"}), 400

    flow = payload.get("flow") if isinstance(payload, dict) else None
    if flow is None or not isinstance(flow, dict):
      return jsonify({"error": "`flow` object is required in request body"}), 400

    feature_count = len(flow) if isinstance(flow, dict) else 0
    print("[ML_API_REQUEST]", {"features_received": feature_count})

    missing = [col for col in FEATURE_COLUMNS if col not in flow]
    if missing:
      print("[FEATURE_VALIDATION_ERROR]", {"missing_columns": missing[:10], "missing_count": len(missing)})
      return (
        jsonify(
          {
            "error": "Missing required features",
            "missing_features": missing,
          }
        ),
        400,
      )

    # Build DataFrame with correct column order
    row = {col: flow[col] for col in FEATURE_COLUMNS}
    flow_df = pd.DataFrame([row])
    print("[ML_API_REQUEST]", {"dataframe_shape": flow_df.shape})

    # Scale and predict
    flow_scaled = SCALER.transform(flow_df)
    pred = int(MODEL.predict(flow_scaled)[0])
    prob = float(MODEL.predict_proba(flow_scaled)[0][1])

    is_attack = pred == 1
    label = "ATTACK DETECTED" if is_attack else "NORMAL TRAFFIC"
    severity = _derive_severity(prob)

    print("[ML_PREDICTION_OUTPUT]", {"prediction": pred, "probability": prob, "is_attack": is_attack})

    return (
      jsonify(
        {
          "prediction": pred,
          "is_attack": is_attack,
          "label": label,
          "probability": prob,
          "severity": severity,
        }
      ),
      200,
    )
  except Exception as exc:
    import traceback
    print("[ML_API_ERROR]", {"error": repr(exc), "stack": traceback.format_exc()})
    return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
  # For development; in production use a WSGI server (gunicorn, etc.)
  app.run(host="0.0.0.0", port=5000, debug=False)

