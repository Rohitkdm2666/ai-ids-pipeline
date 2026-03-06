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

Features must match the top 20 selected from CICIDS2017 (loaded from Data/top20_features.json).
"""

import json
import logging
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
  return jsonify({"status": "ok"}), 200


def _load_artifacts():
  """Load trained model, scaler, and top 20 feature schema."""
  script_dir = Path(__file__).parent
  project_root = script_dir.parent.parent

  model_path = project_root / "Trained Models" / "Models" / "ids_random_forest_model.pkl"
  scaler_path = project_root / "Trained Models" / "Models" / "scaler.pkl"
  top20_path = project_root / "Data" / "top20_features.json"

  model = joblib.load(model_path)
  scaler = joblib.load(scaler_path)

  with open(top20_path) as f:
    feature_columns = json.load(f)

  logger.info("[ML_API] Loaded model, scaler, and %d features from top20_features.json", len(feature_columns))
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
    logger.info("[ML_API_REQUEST] features_received=%d, expected=%d", feature_count, len(FEATURE_COLUMNS))

    missing = [col for col in FEATURE_COLUMNS if col not in flow]
    if missing:
      logger.warning("[FEATURE_VALIDATION_ERROR] missing_columns=%s", missing[:10])
      return (
        jsonify(
          {
            "error": "Missing required features",
            "missing_features": missing,
          }
        ),
        400,
      )

    # Build DataFrame with correct column order (only top 20, ignore any extra keys)
    row = {col: float(flow[col]) for col in FEATURE_COLUMNS}
    flow_df = pd.DataFrame([row], columns=FEATURE_COLUMNS)
    logger.info("[ML_API_REQUEST] dataframe_shape=%s", flow_df.shape)

    # Scale and predict
    flow_scaled = SCALER.transform(flow_df)
    pred = int(MODEL.predict(flow_scaled)[0])
    prob = float(MODEL.predict_proba(flow_scaled)[0][1])

    is_attack = pred == 1
    label = "ATTACK DETECTED" if is_attack else "NORMAL TRAFFIC"
    severity = _derive_severity(prob)

    logger.info("[ML_PREDICTION_OUTPUT] prediction=%d probability=%.4f is_attack=%s", pred, prob, is_attack)

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
    logger.exception("[ML_API_ERROR] %s", exc)
    return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
  # For development; in production use a WSGI server (gunicorn, etc.)
  app.run(host="0.0.0.0", port=5000, debug=False)

