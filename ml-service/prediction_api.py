"""
ML Prediction API - Flask server on port 5000.
POST /predict with flow (top 20 features).
Loads model.pkl, scaler.pkl, top20_features.json from ml-service/model/
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

SCRIPT_DIR = Path(__file__).parent.resolve()
MODEL_DIR = SCRIPT_DIR / "model"

MODEL = joblib.load(MODEL_DIR / "model.pkl")
SCALER = joblib.load(MODEL_DIR / "scaler.pkl")
with open(MODEL_DIR / "top20_features.json") as f:
    FEATURE_COLUMNS = json.load(f)

logger.info("[ML_API] Loaded model, scaler, %d features", len(FEATURE_COLUMNS))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


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

        logger.info("[ML_API_REQUEST] features_received=%d expected=%d", len(flow), len(FEATURE_COLUMNS))

        missing = [col for col in FEATURE_COLUMNS if col not in flow]
        if missing:
            logger.warning("[FEATURE_VALIDATION_ERROR] missing=%s", missing[:5])
            return jsonify({"error": "Missing required features", "missing_features": missing}), 400

        # Build row with exactly top 20 features in order; ignore extra keys
        row = {}
        for col in FEATURE_COLUMNS:
            try:
                row[col] = float(flow.get(col, 0))
            except (TypeError, ValueError):
                row[col] = 0.0
        flow_df = pd.DataFrame([row], columns=FEATURE_COLUMNS)
        logger.info("[ML_REQUEST_SENT] features=%d", len(flow))
        
        flow_scaled = SCALER.transform(flow_df)
        pred = int(MODEL.predict(flow_scaled)[0])
        prob = float(MODEL.predict_proba(flow_scaled)[0][1])
        is_attack = pred == 1
        label = "ATTACK DETECTED" if is_attack else "NORMAL TRAFFIC"
        severity = _derive_severity(prob)

        logger.info("[ML_RESPONSE_RECEIVED] prediction=%d probability=%.4f is_attack=%s label=%s severity=%s", pred, prob, is_attack, label, severity)
        logger.info("[ATTACK_CLASSIFICATION] is_attack=%s severity=%s probability=%.4f", is_attack, severity, prob)

        return jsonify({
            "prediction": pred,
            "is_attack": is_attack,
            "label": label,
            "probability": prob,
            "severity": severity,
        }), 200
    except Exception as exc:
        logger.exception("[ML_API_ERROR] %s", exc)
        return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
