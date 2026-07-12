import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { runAgent1, runAgent2, runAgent3, invalidatePipelineCache } from "../server/pipeline";
import { dbAdmin } from "../server/firebaseAdmin";
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";

const app = express();

const ipCache = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 mins
const RATE_LIMIT_MAX = 50; // max 50 requests per window

const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  
  let record = ipCache.get(ip);
  if (!record || (now - record.lastReset) > RATE_LIMIT_WINDOW) {
    record = { count: 1, lastReset: now };
    ipCache.set(ip, record);
    return next();
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  
  record.count++;
  next();
};

function validateBase64ImageSignature(base64Str: string): boolean {
  const dataIndex = base64Str.indexOf(',');
  const cleanBase64 = dataIndex !== -1 ? base64Str.substring(dataIndex + 1) : base64Str;
  const prefix = cleanBase64.substring(0, 16);
  return prefix.startsWith('/9j/') || prefix.startsWith('iVBORw');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/debug", async (req, res) => {
  const diagnostic: any = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      HAS_GEMINI_KEY: !!process.env.GEMINI_API_KEY,
      GEMINI_KEY_PREFIX: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 6) : null,
      HAS_FIREBASE_CONFIG_JSON: !!process.env.FIREBASE_CONFIG_JSON,
    },
    firebase: {
      status: "unknown"
    }
  };

  try {
    const localConfig = (await import("../firebase-applet-config")).default;
    diagnostic.firebase.localConfigKeys = Object.keys(localConfig);
  } catch (err: any) {
    diagnostic.firebase.localConfigError = err.message;
  }

  try {
    const { limit, getDocs } = await import("firebase/firestore");
    const issuesQuery = query(collection(dbAdmin, 'issues'), limit(1));
    const snap = await getDocs(issuesQuery);
    diagnostic.firebase.status = "connected";
    diagnostic.firebase.issuesCount = snap.size;
  } catch (err: any) {
    diagnostic.firebase.status = "error";
    diagnostic.firebase.error = err.message;
    diagnostic.firebase.stack = err.stack;
  }

  res.json(diagnostic);
});

// Seed endpoint for demo
app.post("/api/seed", rateLimiter, async (req, res) => {
  try {
    const batch = writeBatch(dbAdmin);
    const clusters = [
      // Karnataka (Bengaluru)
      { lat: 12.9352, lng: 77.6245, category: 'pothole', title: 'Severe Pothole near Signal', desc: 'Large crater in the middle of the road causing traffic slowdowns.' },
      { lat: 12.9348, lng: 77.6250, category: 'garbage', title: 'Overflowing dump bin', desc: 'Garbage hasn\'t been collected for 3 days, spilling onto sidewalk.' },
      { lat: 12.9360, lng: 77.6240, category: 'streetlight', title: 'Streetlight out', desc: 'Pitch black crossing, very dangerous at night.' },

      // Delhi NCR (New Delhi)
      { lat: 28.6139, lng: 77.2090, category: 'pothole', title: 'Road damage near Connaught Place', desc: 'Deep pothole on the main avenue causing minor accidents.' },
      { lat: 28.6150, lng: 77.2100, category: 'water_leakage', title: 'Water Main Leak', desc: 'Water pipeline burst spraying clean water onto the street.' },

      // Maharashtra (Mumbai)
      { lat: 19.0760, lng: 72.8777, category: 'garbage', title: 'Dumping on Bandra Beach', desc: 'Huge pile of plastics and garbage dumped near the shore.' },
      { lat: 19.0780, lng: 72.8790, category: 'streetlight', title: 'Corrupt Junction Box', desc: 'Short circuit causing streetlights to flicker repeatedly.' },

      // Tamil Nadu (Chennai)
      { lat: 13.0827, lng: 80.2707, category: 'water_leakage', title: 'Major Water Leak near Central', desc: 'Leaking pipe node inundating the pedestrian walking lane.' },

      // Telangana (Hyderabad)
      { lat: 17.3850, lng: 78.4867, category: 'pothole', title: 'Pothole near Charminar Node', desc: 'Damaged road surface causing delays for tourist traffic.' },

      // West Bengal (Kolkata)
      { lat: 22.5726, lng: 88.3639, category: 'garbage', title: 'Waste Heap in Market Ward', desc: 'Waste heap causing odor issues and blocking lane.' }
    ];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const issueRef = doc(collection(dbAdmin, 'issues'));
      batch.set(issueRef, {
        category: cluster.category,
        auto_title: cluster.title,
        auto_description: cluster.desc,
        lat: cluster.lat,
        lng: cluster.lng,
        severity_score: 4,
        severity_justification: 'AI deemed this a safety hazard based on typical patterns.',
        status: 'Reported',
        report_count: 10 + i * 5,
        priority_score: 4 * Math.log(10 + i * 5 + 1),
        created_at: Date.now() - 1000000,
        updated_at: Date.now(),
      });
    }
    await batch.commit();
    res.json({ success: true, message: 'Seeded DB' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Orchestrator Endpoint
app.post("/api/reports", rateLimiter, async (req, res) => {
  try {
    const { photoBase64, mimeType, caption, lat, lng, userId } = req.body;
    if (!photoBase64 || !lat || !lng) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!validateBase64ImageSignature(photoBase64)) {
      return res.status(400).json({ error: "Invalid image format. Only JPEG and PNG are supported." });
    }

    console.log(`[Orchestrator] Starting pipeline for new report at ${lat}, ${lng}`);

    // Step 1: Agent 1 (Categorization)
    console.log(`[Orchestrator] Running Agent 1 (Categorization)...`);
    const agent1Result = await runAgent1(photoBase64, mimeType, caption);
    console.log(`[Orchestrator] Agent 1 output:`, agent1Result);

    // Step 2: Agent 2 (Deduplication)
    console.log(`[Orchestrator] Running Agent 2 (Deduplication)...`);
    const agent2Result = await runAgent2(
      agent1Result.auto_description,
      lat,
      lng,
      agent1Result.category
    );
    console.log(`[Orchestrator] Agent 2 output:`, agent2Result);

    let targetIssueId = agent2Result.matched_issue_id;
    let reportCount = 1;

    const batch = writeBatch(dbAdmin);
    const reportRef = doc(collection(dbAdmin, 'reports'));
    const now = Date.now();

    if (agent2Result.decision === 'merge' && targetIssueId) {
      console.log(`[Orchestrator] Merging into existing issue: ${targetIssueId}`);
      const issueRef = doc(dbAdmin, 'issues', targetIssueId);
      const issueSnap = await getDoc(issueRef);
      if (issueSnap.exists()) {
        reportCount = (issueSnap.data()?.report_count || 1) + 1;
      }
      
      // Agent 3: Re-score Severity without passing the heavy image (text-only re-scoring)
      console.log(`[Orchestrator] Running Agent 3 (Severity re-scoring, text-only)...`);
      const agent3Result = await runAgent3(
        agent1Result.category,
        agent1Result.auto_description,
        reportCount
      );
      console.log(`[Orchestrator] Agent 3 output:`, agent3Result);

      const priorityScore = agent3Result.urgency_score * Math.log(reportCount + 1);

      batch.update(issueRef, {
        report_count: reportCount,
        severity_score: agent3Result.urgency_score,
        severity_justification: agent3Result.justification,
        priority_score: priorityScore,
        updated_at: now
      });
    } else {
      console.log(`[Orchestrator] Creating new issue...`);
      // Bypass Agent 3 vision call - use Agent 1's combined categorization + severity scoring
      const severityScore = agent1Result.severity_signal || 3;
      const severityJustification = agent1Result.severity_justification || 'AI estimated severity based on visual details.';
      
      const priorityScore = severityScore * Math.log(2);

      const newIssueRef = doc(collection(dbAdmin, 'issues'));
      targetIssueId = newIssueRef.id;

      batch.set(newIssueRef, {
        category: agent1Result.category,
        auto_title: agent1Result.auto_title,
        auto_description: agent1Result.auto_description,
        lat,
        lng,
        severity_score: severityScore,
        severity_justification: severityJustification,
        status: 'Reported',
        report_count: 1,
        priority_score: priorityScore,
        embedding_vector: agent2Result.newEmbedding,
        created_at: now,
        updated_at: now
      });
    }

    // Save the report
    let safePhotoUrl = req.body.photoUrl || '';
    if (safePhotoUrl.length > 1000000) {
      safePhotoUrl = ''; // Avoid Firestore limit error
    }

    batch.set(reportRef, {
      issue_id: targetIssueId,
      user_id: userId || 'anonymous',
      photo_url: safePhotoUrl,
      raw_caption: caption || '',
      created_at: now
    });

    const notificationRef = doc(collection(dbAdmin, 'notifications'));
    batch.set(notificationRef, {
      user_id: userId || 'anonymous',
      title: agent2Result.decision === 'merge' ? 'Report Merged & Verified' : 'New Issue Registered',
      message: agent2Result.decision === 'merge'
        ? `Your report was merged with an existing ticket: '${agent1Result.auto_title}'.`
        : `Your report for '${agent1Result.auto_title}' was successfully registered.`,
      issue_id: targetIssueId,
      read: false,
      created_at: now
    });

    await batch.commit();
    invalidatePipelineCache(agent1Result.category);
    console.log(`[Orchestrator] Pipeline complete! Issue ID: ${targetIssueId}`);

    res.json({
      success: true,
      issue_id: targetIssueId,
      decision: agent2Result.decision,
      title: agent1Result.auto_title
    });

  } catch (error) {
    console.error("[Orchestrator] Error in real pipeline:", error);
    console.log("[Orchestrator] Activating Demo Fallback Mode due to API/Billing suspension...");
    
    try {
      const { caption, lat, lng } = req.body;
      const text = (caption || "").toLowerCase();
      
      let category = "other";
      if (text.includes("pothole") || text.includes("road") || text.includes("hole")) category = "pothole";
      else if (text.includes("light") || text.includes("lamp") || text.includes("dark")) category = "streetlight";
      else if (text.includes("garbage") || text.includes("trash") || text.includes("rubbish") || text.includes("waste")) category = "garbage";
      else if (text.includes("water") || text.includes("leak") || text.includes("pipe") || text.includes("burst")) category = "water_leakage";
      
      const title = `Reported ${category.replace("_", " ")}`;
      const mockIssueId = "mock_" + Math.random().toString(36).substring(2, 12);
      
      // Attempt writing to Firestore (in case DB is working but Gemini is not)
      try {
        const batch = writeBatch(dbAdmin);
        const newIssueRef = doc(dbAdmin, 'issues', mockIssueId);
        batch.set(newIssueRef, {
          category,
          auto_title: title,
          auto_description: caption || `A report about ${category}`,
          lat: lat || 12.9352,
          lng: lng || 77.6245,
          severity_score: 3,
          severity_justification: "Automatically determined in fallback simulation.",
          status: 'Reported',
          report_count: 1,
          priority_score: 3 * Math.log(2),
          created_at: Date.now(),
          updated_at: Date.now()
        });
        await batch.commit();
        console.log("[Orchestrator] Fallback write to Firestore succeeded!");
      } catch (dbErr) {
        console.warn("[Orchestrator] Firestore write failed during fallback:", dbErr);
        // Continue with mock success response so the client doesn't break
      }
      
      return res.json({
        success: true,
        issue_id: mockIssueId,
        decision: "create",
        title: title,
        is_mocked: true
      });
    } catch (fallbackErr) {
      res.status(500).json({ error: "Pipeline failure and fallback failed: " + String(fallbackErr) });
    }
  }
});

export default app;
