import dotenv from "dotenv";
dotenv.config();

import path from "path";
import app from "./server-app";

async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Vite middleware / Static assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(expressStaticFallback(distPath));
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const { WebSocketServer } = await import("ws");
  const { GoogleGenAI, Modality } = await import("@google/genai");
  const wss = new WebSocketServer({ server: httpServer, path: "/api/live" });
  
  let activeConnections = 0;
  const MAX_CONCURRENT_SESSIONS = 5;

  wss.on("connection", async (clientWs) => {
    if (activeConnections >= MAX_CONCURRENT_SESSIONS) {
      console.warn("[WebSocket] Connection rejected: Max sessions reached");
      clientWs.close(1008, "Max concurrent sessions reached");
      return;
    }

    activeConnections++;
    console.log(`[WebSocket] Client connected. Active sessions: ${activeConnections}`);
    
    let lastActivityTime = Date.now();
    let packetCount = 0;
    let limitResetTime = Date.now();

    // Idle connection checker (triggers every 10 seconds, times out after 60 seconds of silence)
    const idleInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityTime;
      if (elapsed > 60000) {
        console.log("[WebSocket] Closing idle session due to 60s inactivity");
        clearInterval(idleInterval);
        clientWs.close(1000, "Inactivity timeout");
      }
    }, 10000);

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
        lastActivityTime = Date.now();
        
        // Rate limit audio packets: max 20 audio packets per second per connection
        const now = Date.now();
        if (now - limitResetTime > 1000) {
          packetCount = 0;
          limitResetTime = now;
        }
        packetCount++;
        if (packetCount > 20) {
          console.warn("[WebSocket] Packet rate limit exceeded, skipping frame");
          return;
        }

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
        clearInterval(idleInterval);
        activeConnections--;
        console.log(`[WebSocket] Client disconnected. Active sessions: ${activeConnections}`);
        session.close();
      });
    } catch (e) {
      clearInterval(idleInterval);
      activeConnections--;
      console.error("Error setting up Live API session:", e);
      clientWs.close();
    }
  });
}

// Helper function to serve static assets fallback
function expressStaticFallback(distPath: string) {
  const express = require("express");
  const router = express.Router();
  router.use(express.static(distPath));
  router.get('*', (req: any, res: any) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  return router;
}

startServer();
