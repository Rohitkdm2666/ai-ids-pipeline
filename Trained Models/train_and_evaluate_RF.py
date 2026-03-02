# ==========================================
# Intrusion Detection System - Full Pipeline
# Train + Evaluate + Export
# ==========================================

import pandas as pd
import numpy as np
import joblib
import time

import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_curve,
    auc
)

# ------------------------------------------
# 1. Load Processed Dataset
# ------------------------------------------
print("\nLoading processed dataset...")

df = pd.read_csv("D:\D Drive Backup\sem 4\EDI\ML model\Data\Processed Data\CICIDS2017_Processed.csv")

print("Dataset shape:", df.shape)

# ------------------------------------------
# 2. Split Features & Labels
# ------------------------------------------
X = df.drop("Label", axis=1)
y = df["Label"]

print("Splitting dataset...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print("Train shape:", X_train.shape)
print("Test shape:", X_test.shape)

# ------------------------------------------
# 3. Scaling (Safe for all models)
# ------------------------------------------
print("\nScaling features...")

scaler = StandardScaler()

X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Save scaler
joblib.dump(scaler, "scaler.pkl")

print("Scaler saved.")

# ------------------------------------------
# 4. Train Random Forest
# ------------------------------------------
print("\nTraining Random Forest...")

start_time = time.time()

rf = RandomForestClassifier(
    n_estimators=100,
    n_jobs=-1,
    random_state=42,
    verbose=1
)

rf.fit(X_train_scaled, y_train)

end_time = time.time()

print(f"\nTraining completed in {end_time - start_time:.2f} seconds")

# ------------------------------------------
# 5. Predictions
# ------------------------------------------
print("\nRunning predictions...")

y_pred = rf.predict(X_test_scaled)
y_prob = rf.predict_proba(X_test_scaled)[:, 1]

# ------------------------------------------
# 6. Accuracy & Report
# ------------------------------------------
accuracy = accuracy_score(y_test, y_pred)

print("\nAccuracy:", accuracy)
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# ------------------------------------------
# 7. Confusion Matrix
# ------------------------------------------
cm = confusion_matrix(y_test, y_pred)

plt.figure(figsize=(6, 4))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
plt.title("Confusion Matrix")
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.show()

# ------------------------------------------
# 8. ROC Curve
# ------------------------------------------
fpr, tpr, _ = roc_curve(y_test, y_prob)
roc_auc = auc(fpr, tpr)

plt.figure()
plt.plot(fpr, tpr, label=f"AUC = {roc_auc:.3f}")
plt.plot([0, 1], [0, 1], '--')
plt.title("ROC Curve")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.legend()
plt.show()

# ------------------------------------------
# 9. Feature Importance
# ------------------------------------------
print("\nCalculating feature importance...")

importance = rf.feature_importances_

feat_imp = pd.Series(importance, index=X.columns)

top_features = feat_imp.sort_values(ascending=False).head(20)

plt.figure(figsize=(8, 6))
top_features.plot(kind='barh')
plt.title("Top 20 Important Features")
plt.show()

# ------------------------------------------
# 10. Save Model
# ------------------------------------------
joblib.dump(rf, "ids_random_forest_model.pkl")

print("\nModel saved as ids_random_forest_model.pkl")

print("\nPipeline completed successfully.")
