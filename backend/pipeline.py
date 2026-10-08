import os
import math
import time
import json
import numpy as np
from google import genai
from google.genai import types
from firebase_admin_setup import db_admin

# Global GenAI Client
_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def cosine_similarity(a: list, b: list) -> float:
    arr1 = np.array(a, dtype=float)
    arr2 = np.array(b, dtype=float)
    norm1 = np.linalg.norm(arr1)
    norm2 = np.linalg.norm(arr2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(arr1, arr2) / (norm1 * norm2))

# =====================================================================
# AGENT 1: Vision Categorization (Gemini - gemini-3.1-flash-lite)
# =====================================================================
def run_agent1(photo_base64: str, mime_type: str, caption: str = "") -> dict:
    client = get_genai_client()
    
    schema = {
        "type": "OBJECT",
        "properties": {
            "category": {"type": "STRING", "enum": ["pothole", "streetlight", "garbage", "water_leakage", "other"]},
            "confidence": {"type": "NUMBER"},
            "auto_title": {"type": "STRING"},
            "auto_description": {"type": "STRING"},
            "severity_signal": {"type": "NUMBER"},
            "severity_justification": {"type": "STRING"},
            "estimated_dimensions": {"type": "STRING"},
            "traffic_impact": {"type": "STRING"},
            "safety_hazard_level": {"type": "STRING"},
            "risk_factors": {
                "type": "ARRAY",
                "items": {"type": "STRING"}
            }
        },
        "required": [
            "category", "auto_title", "auto_description", 
            "severity_signal", "severity_justification", 
            "estimated_dimensions", "traffic_impact", 
            "safety_hazard_level", "risk_factors"
        ]
    }

    prompt = f"""Perform multimodal vision analysis on this civic report.
Caption: "{caption or 'None'}".
Title: Max 5 words.
Description: Max 12 words summary.
Estimated dimensions: Visual scale estimation (e.g. "1.2m x 0.8m, depth ~15cm" or "2m pile" or "Single fixture").
Traffic impact: Short impact summary (e.g., "Active Lane Blockage", "Sidewalk Obstruction", "Low Traffic Delay").
Safety hazard level: "Critical", "High", "Moderate", or "Low".
Risk factors: 2-3 key risk signals (e.g. ["Vehicle Damaging", "Pedestrian Slip", "Night Risk"])."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            prompt,
            {
                "inline_data": {
                    "data": photo_base64,
                    "mime_type": mime_type
                }
            }
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.1,
            max_output_tokens=600
        )
    )

    if not response.text:
        raise ValueError("Agent 1 returned empty response")

    return json.loads(response.text)

# =====================================================================
# AGENT 2: Deduplication & Clustering
# =====================================================================
def run_agent2(description: str, lat: float, lng: float, category: str) -> dict:
    client = get_genai_client()

    # 1. Get embedding (text-embedding-004)
    embedding_res = client.models.embed_content(
        model="text-embedding-004",
        contents=description
    )
    
    new_embedding = embedding_res.embedding.values if hasattr(embedding_res, 'embedding') else embedding_res.embeddings[0].values

    # 2. Fetch active issues from Firestore
    issues_data = []
    if db_admin:
        try:
            issues_ref = db_admin.collection('issues')
            query = issues_ref.where('category', '==', category).where('status', 'in', ['Reported', 'Community Verified', 'Acknowledged', 'In Progress'])
            docs = query.get()
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                issues_data.append(data)
        except Exception as err:
            print(f"[Agent 2 Py] Error querying Firestore issues: {err}")

    radius_map = {
        'pothole': 60,
        'garbage': 150,
        'streetlight': 100,
        'water_leakage': 80,
        'other': 100
    }
    search_radius = radius_map.get(category, 100)

    best_candidate = None
    max_similarity = -1.0

    for issue in issues_data:
        i_lat = issue.get('lat')
        i_lng = issue.get('lng')
        if i_lat is None or i_lng is None:
            continue

        dist = haversine_distance(lat, lng, float(i_lat), float(i_lng))
        if dist <= search_radius:
            saved_vector = issue.get('embedding_vector')
            if saved_vector and isinstance(saved_vector, list):
                sim = cosine_similarity(new_embedding, saved_vector)
                if sim > max_similarity:
                    max_similarity = sim
                    best_candidate = {
                        "issue_id": issue.get('id'),
                        "similarity": sim,
                        "title": issue.get('auto_title'),
                        "desc": issue.get('auto_description')
                    }

    if best_candidate and max_similarity >= 0.85:
        reasoning_prompt = f"""Compare two reports to confirm if they are the exact same civic issue.
New Report: "{description}"
Existing Report: "{best_candidate['desc']}"
Decision rule: Return "merge" if they describe the exact same event/location hazard, otherwise "create"."""

        schema = {
            "type": "OBJECT",
            "properties": {
                "decision": {"type": "STRING", "enum": ["merge", "create"]},
                "reasoning": {"type": "STRING"}
            },
            "required": ["decision", "reasoning"]
        }

        merge_res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=reasoning_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.1
            )
        )
        merge_result = json.loads(merge_res.text or '{}')
        if merge_result.get('decision') == 'merge':
            return {
                "decision": "merge",
                "matched_issue_id": best_candidate['issue_id'],
                "similarity_score": max_similarity,
                "newEmbedding": new_embedding
            }

    return {
        "decision": "create",
        "matched_issue_id": None,
        "similarity_score": max_similarity if best_candidate else 0.0,
        "newEmbedding": new_embedding
    }

# =====================================================================
# AGENT 3: Severity & Urgency Scoring
# =====================================================================
def run_agent3(category: str, auto_description: str, report_count: int, photo_base64: str = None, mime_type: str = None) -> dict:
    client = get_genai_client()

    schema = {
        "type": "OBJECT",
        "properties": {
            "urgency_score": {"type": "NUMBER"},
            "justification": {"type": "STRING"}
        },
        "required": ["urgency_score", "justification"]
    }

    prompt = f"""Rate urgency 1-5 for civic issue. Category: "{category}". Description: "{auto_description}". Report count: {report_count}."""

    contents = [prompt]
    if photo_base64 and mime_type:
        contents.append({
            "inline_data": {
                "data": photo_base64,
                "mime_type": mime_type
            }
        })

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.1,
            max_output_tokens=300
        )
    )

    if not response.text:
        return {"urgency_score": 3, "justification": "Default fallback rating."}

    return json.loads(response.text)
