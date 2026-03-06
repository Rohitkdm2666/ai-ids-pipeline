import pandas as pd
import requests

print("Loading flows.csv...")

# Read extracted flows
df = pd.read_csv("flows.csv")

if df.empty:
    print("ERROR: flows.csv has no rows")
    exit()

# Take first flow
flow = df.iloc[0].to_dict()

print("Sending flow with", len(flow), "features to API")

response = requests.post(
    "http://localhost:5000/predict",
    json={"flow": flow}
)

print("Response from API:")
print(response.json())