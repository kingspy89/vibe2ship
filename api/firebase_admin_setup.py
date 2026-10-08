import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

project_id = "civicpulse-app-9bdfd"

def init_firebase():
    global project_id
    config = None
    if os.getenv("FIREBASE_CONFIG_JSON"):
        try:
            config = json.loads(os.getenv("FIREBASE_CONFIG_JSON"))
            print("[Firebase Admin Py] Initialized using FIREBASE_CONFIG_JSON env variable.")
        except Exception as err:
            print(f"[Firebase Admin Py] Error parsing FIREBASE_CONFIG_JSON: {err}")

    if not config and os.path.exists("firebase-applet-config.json"):
        try:
            with open("firebase-applet-config.json", "r") as f:
                config = json.load(f)
            print("[Firebase Admin Py] Initialized using bundled firebase-applet-config.json.")
        except Exception as err:
            print(f"[Firebase Admin Py] Error reading firebase-applet-config.json: {err}")

    if config and config.get("projectId"):
        project_id = config.get("projectId")
    else:
        project_id = os.getenv("FIREBASE_PROJECT_ID", "vibe2ship-e4ed0")

    if not firebase_admin._apps:
        app = firebase_admin.initialize_app(options={'projectId': project_id})
    else:
        app = firebase_admin.get_app()

    try:
        db = firestore.client(app=app)
        database_id = config.get("firestoreDatabaseId") if config else "(default)"
        if database_id and database_id != "(default)":
            db._database = database_id
        return db
    except Exception as e:
        print(f"[Firebase Admin Py] Firestore client init error: {e}")
        return None

try:
    db_admin = init_firebase()
except Exception as e:
    print(f"[Firebase Admin Py] Warning initializing Firestore: {e}")
    db_admin = None
