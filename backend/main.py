import os
import time
import math
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from firebase_admin_setup import db_admin, project_id
from pipeline import run_agent1, run_agent2, run_agent3

app = FastAPI(title="CivicPulse AI Python Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Allow all origins (update to specific Vercel URL after deploy if desired)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    """Root endpoint — used by Render for health checks."""
    return {"status": "ok", "service": "CivicPulse AI Backend"}

class ReportRequest(BaseModel):
    photoBase64: str
    mimeType: str
    caption: Optional[str] = ""
    lat: float
    lng: float
    userId: Optional[str] = "anonymous"

def validate_image_signature(base64_str: str) -> bool:
    data_idx = base64_str.find(',')
    clean_b64 = base64_str[data_idx + 1:] if data_idx != -1 else base64_str
    prefix = clean_b64[:16]
    return prefix.startswith('/9j/') or prefix.startswith('iVBORw')

@app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "python-fastapi"}

@app.get("/api/debug")
def debug_info():
    gemini_key = os.getenv("GEMINI_API_KEY")
    return {
        "env": {
            "NODE_ENV": os.getenv("NODE_ENV", "development"),
            "HAS_GEMINI_KEY": bool(gemini_key),
            "GEMINI_KEY_PREFIX": gemini_key[:6] if gemini_key else None,
            "PROJECT_ID": project_id
        },
        "firebase": {
            "status": "connected" if db_admin else "error",
            "db_admin_null": db_admin is None
        }
    }

@app.post("/api/seed")
def seed_database():
    if not db_admin:
        raise HTTPException(status_code=500, detail="Database connection is null")
    
    clusters = [
        {"lat": 12.9352, "lng": 77.6245, "category": 'pothole', "title": 'Severe Pothole near Signal', "desc": 'Large crater in the middle of the road causing traffic slowdowns.'},
        {"lat": 12.9348, "lng": 77.6250, "category": 'garbage', "title": 'Overflowing dump bin', "desc": 'Garbage has not been collected for 3 days, spilling onto sidewalk.'},
        {"lat": 12.9360, "lng": 77.6240, "category": 'streetlight', "title": 'Streetlight out', "desc": 'Pitch black crossing, very dangerous at night.'},
        {"lat": 28.6139, "lng": 77.2090, "category": 'pothole', "title": 'Road damage near Connaught Place', "desc": 'Deep pothole on the main avenue causing minor accidents.'},
        {"lat": 28.6150, "lng": 77.2100, "category": 'water_leakage', "title": 'Water Main Leak', "desc": 'Water pipeline burst spraying clean water onto the street.'},
        {"lat": 19.0760, "lng": 72.8777, "category": 'garbage', "title": 'Dumping on Bandra Beach', "desc": 'Huge pile of plastics and garbage dumped near the shore.'},
        {"lat": 19.0780, "lng": 72.8790, "category": 'streetlight', "title": 'Corrupt Junction Box', "desc": 'Short circuit causing streetlights to flicker repeatedly.'},
        {"lat": 13.0827, "lng": 80.2707, "category": 'water_leakage', "title": 'Major Water Leak near Central', "desc": 'Leaking pipe node inundating the pedestrian walking lane.'},
        {"lat": 17.3850, "lng": 78.4867, "category": 'pothole', "title": 'Pothole near Charminar Node', "desc": 'Damaged road surface causing delays for tourist traffic.'},
        {"lat": 22.5726, "lng": 88.3639, "category": 'garbage', "title": 'Waste Heap in Market Ward', "desc": 'Waste heap causing odor issues and blocking lane.'}
    ]

    batch = db_admin.batch()
    now_ms = int(time.time() * 1000)

    for i, cluster in enumerate(clusters):
        issue_ref = db_admin.collection('issues').document()
        rep_count = 10 + i * 5
        priority = 4.0 * math.log(rep_count + 1)
        batch.set(issue_ref, {
            'category': cluster['category'],
            'auto_title': cluster['title'],
            'auto_description': cluster['desc'],
            'lat': cluster['lat'],
            'lng': cluster['lng'],
            'severity_score': 4,
            'severity_justification': 'AI deemed this a safety hazard based on typical patterns.',
            'status': 'Reported',
            'report_count': rep_count,
            'priority_score': priority,
            'created_at': now_ms - 1000000,
            'updated_at': now_ms,
        })
    batch.commit()
    return {"success": True, "message": "Seeded DB"}

@app.post("/api/reports")
def process_report(body: ReportRequest):
    if not body.photoBase64 or not body.lat or not body.lng:
        raise HTTPException(status_code=400, detail="Missing required fields")

    if not validate_image_signature(body.photoBase64):
        raise HTTPException(status_code=400, detail="Invalid image format. Only JPEG and PNG are supported.")

    if not db_admin:
        raise HTTPException(status_code=500, detail="Firestore db_admin is null")

    now = int(time.time() * 1000)

    # Agent 1: Vision Triage
    agent1_res = run_agent1(body.photoBase64, body.mimeType, body.caption or "")
    
    # Agent 2: Deduplication
    agent2_res = run_agent2(
        agent1_res.get("auto_description", ""),
        body.lat,
        body.lng,
        agent1_res.get("category", "other")
    )

    target_issue_id = agent2_res.get("matched_issue_id")
    report_count = 1
    final_severity = agent1_res.get("severity_signal", 3)
    final_justification = agent1_res.get("severity_justification", "AI visual severity signal.")
    priority_score = final_severity * math.log(2)

    batch = db_admin.batch()

    if agent2_res.get("decision") == "merge" and target_issue_id:
        issue_ref = db_admin.collection('issues').document(target_issue_id)
        issue_snap = issue_ref.get()
        if issue_snap.exists:
            report_count = (issue_snap.to_dict().get('report_count') or 1) + 1

        agent3_res = run_agent3(
            agent1_res.get("category", "other"),
            agent1_res.get("auto_description", ""),
            report_count,
            body.photoBase64,
            body.mimeType
        )
        final_severity = agent3_res.get("urgency_score", final_severity)
        final_justification = agent3_res.get("justification", final_justification)
        priority_score = final_severity * math.log(report_count + 1)

        batch.update(issue_ref, {
            'report_count': report_count,
            'severity_score': final_severity,
            'severity_justification': final_justification,
            'priority_score': priority_score,
            'updated_at': now
        })
    else:
        agent3_res = run_agent3(
            agent1_res.get("category", "other"),
            agent1_res.get("auto_description", ""),
            1,
            body.photoBase64,
            body.mimeType
        )
        final_severity = agent3_res.get("urgency_score", final_severity)
        final_justification = agent3_res.get("justification", final_justification)
        priority_score = final_severity * math.log(2)

        new_issue_ref = db_admin.collection('issues').document()
        target_issue_id = new_issue_ref.id

        batch.set(new_issue_ref, {
            'category': agent1_res.get("category", "other"),
            'auto_title': agent1_res.get("auto_title", "Civic Report"),
            'auto_description': agent1_res.get("auto_description", ""),
            'lat': body.lat,
            'lng': body.lng,
            'severity_score': final_severity,
            'severity_justification': final_justification,
            'status': 'Reported',
            'report_count': 1,
            'priority_score': priority_score,
            'estimated_dimensions': agent1_res.get("estimated_dimensions", "1.0m x 0.5m"),
            'traffic_impact': agent1_res.get("traffic_impact", "Active Lane Disruption"),
            'safety_hazard_level': agent1_res.get("safety_hazard_level", "High"),
            'risk_factors': agent1_res.get("risk_factors", ["Road Hazard"]),
            'embedding_vector': agent2_res.get("newEmbedding"),
            'created_at': now,
            'updated_at': now
        })

    photo_url_to_write = f"data:{body.mimeType};base64,{body.photoBase64}" if body.photoBase64 else ""
    report_ref = db_admin.collection('reports').document()
    batch.set(report_ref, {
        'issue_id': target_issue_id,
        'user_id': body.userId or 'anonymous',
        'photo_url': photo_url_to_write,
        'raw_caption': body.caption or '',
        'created_at': now
    })

    notification_ref = db_admin.collection('notifications').document()
    batch.set(notification_ref, {
        'user_id': body.userId or 'anonymous',
        'title': 'Report Merged & Verified' if agent2_res.get("decision") == 'merge' else 'New Issue Registered',
        'message': f"Your report was merged with existing ticket: '{agent1_res.get('auto_title')}'." if agent2_res.get("decision") == 'merge' else f"Your report for '{agent1_res.get('auto_title')}' was registered.",
        'issue_id': target_issue_id,
        'read': False,
        'created_at': now
    })

    batch.commit()

    return {
        "success": True,
        "issue_id": target_issue_id,
        "decision": agent2_res.get("decision", "create"),
        "title": agent1_res.get("auto_title"),
        "category": agent1_res.get("category"),
        "description": agent1_res.get("auto_description"),
        "severity_score": final_severity,
        "severity_justification": final_justification,
        "priority_score": priority_score,
        "estimated_dimensions": agent1_res.get("estimated_dimensions", "1.0m x 0.5m"),
        "traffic_impact": agent1_res.get("traffic_impact", "Active Lane Disruption"),
        "safety_hazard_level": agent1_res.get("safety_hazard_level", "High"),
        "risk_factors": agent1_res.get("risk_factors", ["Road Hazard"]),
        "created_at": now
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
