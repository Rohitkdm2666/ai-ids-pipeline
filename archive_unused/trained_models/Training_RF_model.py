# ================================
# Cyber Attack Detection Training
# ================================

import pandas as pd
import numpy as np
import joblib
import time

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score

# -------------------------------
# 1. Load Dataset
# -------------------------------
print("Loading processed dataset...")

df = pd.read_csv("D:\D Drive Backup\sem 4\EDI\ML model\CICIDS2017_Processed.csv")

print("Dataset shape:", df.shape)

# -------------------------------
# 2. Split Features & Label
# -------------------------------
X = df.drop("Label", axis=1)
y = df["Label"]

print("Splitting data...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# -------------------------------
# 3. Feature Scaling
# -------------------------------
print("Scaling features...")

scaler = StandardScaler()

X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# Save scaler
joblib.dump(scaler, "scaler.pkl")

print("Scaler saved.")

# -------------------------------
# 4. Train Model
# -------------------------------
print("Training Random Forest Model...")

start_time = time.time()

rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=None,
    random_state=42,
    n_jobs=-1,
    verbose=1   # Shows training progress
)

rf.fit(X_train, y_train)

end_time = time.time()

print(f"Training completed in {end_time - start_time:.2f} seconds")

# -------------------------------
# 5. Evaluation
# -------------------------------
print("Evaluating model...")

y_pred = rf.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\nAccuracy:", accuracy)
print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# -------------------------------
# 6. Save Model
# -------------------------------
joblib.dump(rf, "ids_random_forest_model.pkl")

print("\nModel saved as ids_random_forest_model.pkl")
