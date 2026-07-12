# -*- coding: utf-8 -*-
"""
CivicPulse AI: Mock Machine Learning Pipeline
This module demonstrates the implementation of the core ML algorithms used in CivicPulse AI:
1. Gemini Vision API (Visual feature extraction)
2. Gemini Embeddings (Semantic representations)
3. Haversine Distance (Geospatial calculations)
4. DBSCAN (Density-based spatial hotspot clustering)
5. LightGBM (Priority score regression)
6. SHAP (Explainable AI for priority scores)

Note: This file is a mock implementation showing the source code patterns.
"""

import numpy as np
import pandas as pd
import lightgbm as lgb
import shap
from sklearn.cluster import DBSCAN
import math
from typing import Dict, List, Tuple, Any

# =====================================================================
# 1. HAVERSINE DISTANCE
# =====================================================================
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth 
    surface in meters using their latitude and longitude coordinates.
    """
    R = 6371000.0  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2) ** 2 + 
         math.cos(phi1) * math.cos(phi2) * 
         math.sin(delta_lambda / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# =====================================================================
# 2. GEMINI VISION & EMBEDDINGS (MOCK API CALLS)
# =====================================================================
def call_gemini_vision_api(image_base64: str) -> Dict[str, Any]:
    """
    Mock call to Gemini-2.5-Flash Vision model.
    Analyzes base64 image and extracts structured properties.
    """
    print("[Gemini Vision] Analyzing image structure...")
    # Simulated model response
    return {
        "category": "pothole",
        "confidence": 0.94,
        "auto_title": "Deep Pothole at Main Junction",
        "auto_description": "Large road crater blocking lane causing major traffic delays.",
        "severity_signal": 4,
        "severity_justification": "Significant depth and position in a high-speed travel lane."
    }

def get_gemini_embedding(text: str) -> np.ndarray:
    """
    Mock call to Gemini Embedding API.
    Generates a 768-dimensional dense vector representing the text.
    """
    # Simulated embedding vector of size 768
    np.random.seed(hash(text) % (2**32 - 1))
    embedding = np.random.uniform(-0.1, 0.1, 768)
    # Normalize embedding to unit length
    return embedding / np.linalg.norm(embedding)


# =====================================================================
# 3. DBSCAN FOR GEOSPATIAL CLUSTERING (HOTSPOT DETECTION)
# =====================================================================
def detect_issue_hotspots(coordinates: List[Tuple[float, float]], eps_meters: float = 100) -> np.ndarray:
    """
    Clusters GPS coordinates using DBSCAN.
    Distance metric is converted from meters to radians for geographical clustering.
    """
    print(f"[DBSCAN] Clustering {len(coordinates)} coordinates with radius {eps_meters}m...")
    kms_per_radian = 6371.0088
    eps_rad = (eps_meters / 1000.0) / kms_per_radian
    
    # DBSCAN expects coordinates in radians (latitude, longitude)
    coords_rad = np.radians(coordinates)
    
    # Run DBSCAN using haversine metric
    db = DBSCAN(eps=eps_rad, min_samples=3, metric='haversine')
    labels = db.fit_predict(coords_rad)
    
    # Returns an array of cluster IDs. -1 indicates noise (no cluster / isolated issues)
    return labels


# =====================================================================
# 4. LIGHTGBM PRIORITY PREDICTION & SHAP EXPLANATIONS
# =====================================================================
def prepare_mock_dataset() -> Tuple[pd.DataFrame, pd.Series]:
    """
    Generates dummy tabular data to train the LightGBM prioritization model.
    """
    np.random.seed(42)
    n_samples = 200
    
    data = {
        "severity_signal": np.random.randint(1, 6, n_samples),
        "report_count": np.random.randint(1, 50, n_samples),
        "distance_to_highway_m": np.random.uniform(5, 500, n_samples),
        "population_density": np.random.uniform(500, 15000, n_samples),
        "is_peak_hours": np.random.choice([0, 1], n_samples),
    }
    
    df = pd.DataFrame(data)
    # Target value: Priority Score calculated using features with added noise
    target = (
        df["severity_signal"] * 1.5 + 
        np.log(df["report_count"] + 1) * 2.0 - 
        (df["distance_to_highway_m"] / 100.0) * 0.5 + 
        np.random.normal(0, 0.5, n_samples)
    )
    
    return df, target

def run_priority_model_pipeline():
    """
    Trains a LightGBM regressor on issue features and interprets it using SHAP.
    """
    X, y = prepare_mock_dataset()
    
    # 1. Train LightGBM model
    train_data = lgb.Dataset(X, label=y)
    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'learning_rate': 0.1,
        'num_leaves': 15,
        'verbose': -1
    }
    
    print("[LightGBM] Training priority prediction model...")
    model = lgb.train(params, train_data, num_boost_rounds=50)
    
    # 2. Predict on a new sample
    sample_issue = pd.DataFrame([{
        "severity_signal": 4,
        "report_count": 12,
        "distance_to_highway_m": 45.0,
        "population_density": 8500.0,
        "is_peak_hours": 1
    }])
    
    predicted_priority = model.predict(sample_issue)[0]
    print(f"[LightGBM] Predicted Priority Score for new issue: {predicted_priority:.3f}")
    
    # 3. Apply SHAP (Explainable AI)
    print("[SHAP] Calculating feature contributions (SHAP values)...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(sample_issue)
    
    # Summarize contributions
    print("\n--- SHAP Feature Contribution breakdown ---")
    base_value = explainer.expected_value
    print(f"Base Value (Average Priority Across Training Data): {base_value:.3f}")
    
    features = sample_issue.columns
    for idx, feature in enumerate(features):
        val = sample_issue.iloc[0][feature]
        impact = shap_values[0][idx]
        print(f"Feature '{feature}' = {val:<7} -> SHAP Impact: {impact:+.3f}")
        
    print(f"Final Priority Score: Base ({base_value:.3f}) + Sum of Impacts ({np.sum(shap_values):+.3f}) = {predicted_priority:.3f}")
    
    return model, explainer


# =====================================================================
# 5. DEMO EXECUTION
# =====================================================================
if __name__ == "__main__":
    print("=== CIVICPULSE AI MACHINE LEARNING PIPELINE MOCK ===")
    
    # Step 1: Simulate Vision & Embeddings
    vision_features = call_gemini_vision_api("mock_base64_image_string...")
    embedding = get_gemini_embedding(vision_features["auto_description"])
    print(f"[Gemini Embeddings] Generated vector successfully. Length: {len(embedding)} dimensions.")
    
    # Step 2: Distance Check
    dist = haversine_distance(12.9352, 77.6245, 12.9348, 77.6250)
    print(f"[Haversine] Distance between report and nearest ticket: {dist:.2f} meters.")
    
    # Step 3: Cluster Hotspots (DBSCAN)
    mock_coordinates = [
        (12.9352, 77.6245), (12.9353, 77.6246), (12.9351, 77.6244),  # Cluster 0
        (12.9400, 77.6300), (12.9401, 77.6301), (12.9399, 77.6299),  # Cluster 1
        (12.9500, 77.6400)                                           # Noise (-1)
    ]
    labels = detect_issue_hotspots(mock_coordinates, eps_meters=50)
    print(f"[DBSCAN] Output Cluster Labels: {labels}")
    
    # Step 4: Priority & Interpretability
    print("")
    run_priority_model_pipeline()
    print("====================================================")
