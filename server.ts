import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { runAgent1, runAgent2, runAgent3 } from "./server/pipeline";
import { dbAdmin } from "./server/firebaseAdmin";
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Seed endpoint for demo
  app.post("/api/seed", async (req, res) => {
    try {
      const batch = writeBatch(dbAdmin);
      const clusters = [
        { lat: 12.9352, lng: 77.6245, category: 'pothole', title: 'Severe Pothole near Signal', desc: 'Large crater in the middle of the road causing traffic slowdowns.' },
        { lat: 12.9348, lng: 77.6250, category: 'garbage', title: 'Overflowing dump bin', desc: 'Garbage hasn\'t been collected for 3 days, spilling onto sidewalk.' },
        { lat: 12.9360, lng: 77.6240, category: 'streetlight', title: 'Streetlight out', desc: 'Pitch black crossing, very dangerous at night.' },
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
  app.post("/api/reports", async (req, res) => {
    try {
      const { photoBase64, mimeType, caption, lat, lng, userId } = req.body;
      if (!photoBase64 || !lat || !lng) {
        return res.status(400).json({ error: "Missing required fields" });
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
        
        // Agent 3: Re-score Severity
        console.log(`[Orchestrator] Running Agent 3 (Severity)...`);
        const agent3Result = await runAgent3(
          agent1Result.category,
          agent1Result.auto_description,
          reportCount,
          photoBase64,
          mimeType
        );
        console.log(`[Orchestrator] Agent 3 output:`, agent3Result);

        // Priority formula: urgency_score * log(report_count + 1) * recency_decay
        // Simplification for hackathon without complex recency_decay
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
        // Agent 3: Score Severity for new issue
        console.log(`[Orchestrator] Running Agent 3 (Severity)...`);
        const agent3Result = await runAgent3(
          agent1Result.category,
          agent1Result.auto_description,
          1,
          photoBase64,
          mimeType
        );
        console.log(`[Orchestrator] Agent 3 output:`, agent3Result);

        const priorityScore = agent3Result.urgency_score * Math.log(2);

        const newIssueRef = doc(collection(dbAdmin, 'issues'));
        targetIssueId = newIssueRef.id;

        batch.set(newIssueRef, {
          category: agent1Result.category,
          auto_title: agent1Result.auto_title,
          auto_description: agent1Result.auto_description,
          lat,
          lng,
          severity_score: agent3Result.urgency_score,
          severity_justification: agent3Result.justification,
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

      await batch.commit();
      console.log(`[Orchestrator] Pipeline complete! Issue ID: ${targetIssueId}`);

      res.json({
        success: true,
        issue_id: targetIssueId,
        decision: agent2Result.decision,
        title: agent1Result.auto_title
      });

    } catch (error) {
      console.error("[Orchestrator] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const { WebSocketServer } = await import("ws");
  const { GoogleGenAI, Modality } = await import("@google/genai");
  const wss = new WebSocketServer({ server: httpServer, path: "/api/live" });
  
  wss.on("connection", async (clientWs) => {
    try {
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful civic issue tracking assistant. Users can ask you how to report issues, check statuses, or what categories exist. Be concise and friendly.",
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio && clientWs.readyState === 1) clientWs.send(JSON.stringify({ audio }));
            if (message.serverContent?.interrupted && clientWs.readyState === 1)
              clientWs.send(JSON.stringify({ interrupted: true }));
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
          },
          onclose: () => {
            console.log("Live API Closed");
            if (clientWs.readyState === 1) {
              clientWs.close();
            }
          }
        },
      });

      clientWs.on("message", (data) => {
        try {
          const { audio } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              audio: { data: audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } catch (e) {
          console.error("Error sending input", e);
        }
      });

      clientWs.on("close", () => {
        session.close();
      });
    } catch (e) {
      console.error("Error setting up Live API session:", e);
      clientWs.close();
    }
  });
}

startServer();
