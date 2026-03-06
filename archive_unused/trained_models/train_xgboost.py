# ==========================================
# Intrusion Detection Model Evaluation Script
# ==========================================

import pandas as pd
import numpy as np
import joblib
import time

import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_curve,
    auc
)

from xgboost import XGBClassifier


# ------------------------------------------
# 1. Load Processed Dataset
# ------------------------------------------
print("Loading processed dataset...")

df = pd.read_csv("CICIDS2017_Processed.csv")

print("Dataset shape:", df.shape)


# ------------------------------------------
# 2. Split Features & Labels
# ------------------------------------------
X = df.drop("Label", axis=1)
y = df["Label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print("Train/Test split completed.")

# ------------------------------------------
# 9. Train XGBoost Comparison Model
# ------------------------------------------
print("\nTraining XGBoost model...")

start = time.time()

xgb = XGBClassifier(
    n_estimators=100,
    max_depth=10,
    learning_rate=0.1,
    n_jobs=-1,
    eval_metric='logloss',
    verbosity=1
)

xgb.fit(X_train, y_train)

end = time.time()

print(f"XGBoost training completed in {end-start:.2f} seconds")


# ------------------------------------------
# 10. XGBoost Evaluation
# ------------------------------------------
y_pred_xgb = xgb.predict(X_test)

xgb_accuracy = accuracy_score(y_test, y_pred_xgb)

print("\nXGBoost Accuracy:", xgb_accuracy)
print("\nXGBoost Classification Report:\n")
print(classification_report(y_test, y_pred_xgb))


# ------------------------------------------
# 11. Save XGBoost Model
# ------------------------------------------
joblib.dump(xgb, "ids_xgboost_model.pkl")

print("\nXGBoost model saved.")
