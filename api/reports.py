"""
Vercel Serverless Function: POST /api/reports
All pipeline and Firebase modules are co-located in this api/ directory.
"""
import os
import json
import time
import math
import traceback
from http.server import BaseHTTPRequestHandler

# ── lazy singletons ──────────────────────────────────────────────────────────
_db_admin = None
_db_ready = False
_run_agent1 = None
_run_agent2 = None
_run_agent3 = None
_agents_ready = False


def _ensure_firebase():
    global _db_admin, _db_ready
    if _db_ready:
        return _db_admin
    try:
        from firebase_admin_setup import db_admin
        _db_admin = db_admin
    except Exception as exc:
        print(f"[reports] Firebase init error: {exc}")
        _db_admin = None
    _db_ready = True
    return _db_admin


def _ensure_agents():
    global _run_agent1, _run_agent2, _run_agent3, _agents_ready
    if _agents_ready:
        return
    from pipeline import run_agent1, run_agent2, run_agent3
    _run_agent1 = run_agent1
    _run_agent2 = run_agent2
    _run_agent3 = run_agent3
    _agents_ready = True


def _valid_image(b64: str) -> bool:
    idx = b64.find(',')
    clean = b64[idx + 1:] if idx != -1 else b64
    return clean[:8].startswith('/9j/') or clean[:8].startswith('iVBORw')


# ── Vercel handler class ──────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):

    # ── CORS pre-flight ───────────────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # ── Main POST handler ─────────────────────────────────────────────────────
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))

            photo_b64 = body.get('photoBase64', '')
            mime      = body.get('mimeType', 'image/jpeg')
            caption   = body.get('caption', '')
            lat       = body.get('lat')
            lng       = body.get('lng')
            user_id   = body.get('userId', 'anonymous')

            # ── validation ────────────────────────────────────────────────────
            if not photo_b64 or lat is None or lng is None:
                return self._json(400, {'error': 'Missing required fields: photoBase64, lat, lng'})

            if not _valid_image(photo_b64):
                return self._json(400, {'error': 'Invalid image format. Only JPEG and PNG supported.'})

            # ── init Firebase & agents ────────────────────────────────────────
            db = _ensure_firebase()
            if not db:
                return self._json(500, {'error': 'Firestore unavailable'})

            _ensure_agents()

            now = int(time.time() * 1000)

            # ── Agent 1 – Vision Triage ───────────────────────────────────────
            a1 = _run_agent1(photo_b64, mime, caption)

            # ── Agent 2 – Deduplication ───────────────────────────────────────
            a2 = _run_agent2(a1.get('auto_description', ''), lat, lng, a1.get('category', 'other'))

            target_id   = a2.get('matched_issue_id')
            rep_count   = 1
            severity    = a1.get('severity_signal', 3)
            justif      = a1.get('severity_justification', 'AI visual severity signal.')
            priority    = severity * math.log(2)

            batch = db.batch()

            if a2.get('decision') == 'merge' and target_id:
                # ── merge path ────────────────────────────────────────────────
                issue_ref  = db.collection('issues').document(target_id)
                issue_snap = issue_ref.get()
                if issue_snap.exists:
                    rep_count = (issue_snap.to_dict().get('report_count') or 1) + 1

                a3       = _run_agent3(a1.get('category', 'other'), a1.get('auto_description', ''), rep_count, photo_b64, mime)
                severity = a3.get('urgency_score', severity)
                justif   = a3.get('justification', justif)
                priority = severity * math.log(rep_count + 1)

                batch.update(issue_ref, {
                    'report_count':          rep_count,
                    'severity_score':        severity,
                    'severity_justification': justif,
                    'priority_score':        priority,
                    'updated_at':            now,
                })

            else:
                # ── create path ───────────────────────────────────────────────
                a3       = _run_agent3(a1.get('category', 'other'), a1.get('auto_description', ''), 1, photo_b64, mime)
                severity = a3.get('urgency_score', severity)
                justif   = a3.get('justification', justif)
                priority = severity * math.log(2)

                new_ref   = db.collection('issues').document()
                target_id = new_ref.id

                batch.set(new_ref, {
                    'category':               a1.get('category', 'other'),
                    'auto_title':             a1.get('auto_title', 'Civic Report'),
                    'auto_description':       a1.get('auto_description', ''),
                    'lat':                    lat,
                    'lng':                    lng,
                    'severity_score':         severity,
                    'severity_justification': justif,
                    'status':                 'Reported',
                    'report_count':           1,
                    'priority_score':         priority,
                    'estimated_dimensions':   a1.get('estimated_dimensions', '1.0m x 0.5m'),
                    'traffic_impact':         a1.get('traffic_impact', 'Active Lane Disruption'),
                    'safety_hazard_level':    a1.get('safety_hazard_level', 'High'),
                    'risk_factors':           a1.get('risk_factors', ['Road Hazard']),
                    'embedding_vector':       a2.get('newEmbedding'),
                    'created_at':             now,
                    'updated_at':             now,
                })

            # ── write report doc ──────────────────────────────────────────────
            batch.set(db.collection('reports').document(), {
                'issue_id':   target_id,
                'user_id':    user_id,
                'photo_url':  f"data:{mime};base64,{photo_b64}",
                'raw_caption': caption,
                'created_at': now,
            })

            # ── write notification ────────────────────────────────────────────
            merged = a2.get('decision') == 'merge'
            batch.set(db.collection('notifications').document(), {
                'user_id':   user_id,
                'title':     'Report Merged & Verified' if merged else 'New Issue Registered',
                'message':   (f"Your report was merged with existing ticket: '{a1.get('auto_title')}'."
                              if merged else
                              f"Your report for '{a1.get('auto_title')}' was registered."),
                'issue_id':  target_id,
                'read':      False,
                'created_at': now,
            })

            batch.commit()

            return self._json(200, {
                'success':              True,
                'issue_id':             target_id,
                'decision':             a2.get('decision', 'create'),
                'title':                a1.get('auto_title'),
                'category':             a1.get('category'),
                'description':          a1.get('auto_description'),
                'severity_score':       severity,
                'severity_justification': justif,
                'priority_score':       priority,
                'estimated_dimensions': a1.get('estimated_dimensions', '1.0m x 0.5m'),
                'traffic_impact':       a1.get('traffic_impact', 'Active Lane Disruption'),
                'safety_hazard_level':  a1.get('safety_hazard_level', 'High'),
                'risk_factors':         a1.get('risk_factors', ['Road Hazard']),
                'created_at':           now,
            })

        except Exception as exc:
            print(f"[reports] Unhandled error: {exc}")
            traceback.print_exc()
            return self._json(500, {'error': str(exc)})

    # ── helpers ───────────────────────────────────────────────────────────────
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')

    def _json(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(body)
