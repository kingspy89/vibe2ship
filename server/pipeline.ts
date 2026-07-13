import { dbAdmin } from "./firebaseAdmin.js";
import Groq from "groq-sdk";

interface CacheItem {
  data: any[];
  timestamp: number;
}

const activeIssuesCache: Record<string, CacheItem> = {};
const CACHE_TTL = 30000; // 30 seconds cache TTL

export function invalidatePipelineCache(category: string) {
  delete activeIssuesCache[category];
  console.log(`[Cache] Invalidated active issues cache for category: ${category}`);
}

// --- Groq client (Agent 1 Vision + Agent 3 Text) ---
let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY environment variable is required');
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}

async function callGroq(
  model: string,
  messages: any[],
  retries = 3,
  delay = 1000
): Promise<string> {
  try {
    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });
    return response.choices[0]?.message?.content || '{}';
  } catch (err: any) {
    const status = err.status || err.statusCode;
    if (retries > 0 && (status === 429 || status === 503)) {
      console.warn(`[Groq] Rate limit (${status}). Retrying ${model} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return callGroq(model, messages, retries - 1, delay * 2);
    }
    throw err;
  }
}

// --- Gemini client (Agent 2 Embeddings only) ---
let aiClient: any = null;

async function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable is required');
    const { GoogleGenAI } = await import("@google/genai");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function callGeminiEmbedding(text: string, retries = 3, delay = 2000): Promise<any> {
  try {
    const ai = await getAI();
    return await ai.models.embedContent({ model: 'gemini-embedding-2', contents: text });
  } catch (err: any) {
    const status = err.status || (err.error && err.error.code);
    if (retries > 0 && (status === 429 || status === 503)) {
      console.warn(`[Gemini Embed] Rate limit (${status}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return callGeminiEmbedding(text, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function callGeminiGenerate(model: string, options: any, retries = 4, delay = 2000): Promise<any> {
  try {
    const ai = await getAI();
    return await ai.models.generateContent({ model, ...options });
  } catch (err: any) {
    const status = err.status || (err.error && err.error.code);
    if (retries > 0 && (status === 429 || status === 503)) {
      console.warn(`[Gemini] Rate limit (${status}). Retrying ${model} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return callGeminiGenerate(model, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

// Haversine distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += Math.pow(A[i], 2);
    normB += Math.pow(B[i], 2);
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ------------------------------------------------------------------
// AGENT 1: Vision Categorization (Gemini - gemini-3.1-flash-lite)
// ------------------------------------------------------------------
export async function runAgent1(photoBase64: string, mimeType: string, caption?: string) {
  const schema: any = {
    type: "OBJECT",
    properties: {
      category: { type: "STRING", enum: ['pothole', 'streetlight', 'garbage', 'water_leakage', 'other'] },
      confidence: { type: "NUMBER" },
      auto_title: { type: "STRING" },
      auto_description: { type: "STRING" },
      severity_signal: { type: "NUMBER" },
      severity_justification: { type: "STRING" },
      estimated_dimensions: { type: "STRING" },
      traffic_impact: { type: "STRING" },
      safety_hazard_level: { type: "STRING" },
      risk_factors: {
        type: "ARRAY",
        items: { type: "STRING" }
      }
    },
    required: [
      "category", 
      "auto_title", 
      "auto_description", 
      "severity_signal", 
      "severity_justification",
      "estimated_dimensions",
      "traffic_impact",
      "safety_hazard_level",
      "risk_factors"
    ]
  };

  const prompt = `Perform multimodal vision analysis on this civic report.
Caption: "${caption || 'None'}".
Title: Max 5 words.
Description: Max 12 words summary.
Estimated dimensions: Visual scale estimation (e.g. "1.2m x 0.8m, depth ~15cm" or "2m pile" or "Single fixture").
Traffic impact: Short impact summary (e.g., "Active Lane Blockage", "Sidewalk Obstruction", "Low Traffic Delay").
Safety hazard level: "Critical", "High", "Moderate", or "Low".
Risk factors: 2-3 key risk signals (e.g. ["Vehicle Damaging", "Pedestrian Slip", "Night Risk"]).`;

  const response = await callGeminiGenerate('gemini-3.1-flash-lite', {
    contents: [
      prompt,
      { inlineData: { data: photoBase64, mimeType } }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
      maxOutputTokens: 600
    }
  });

  console.log("[runAgent1] Full response:", JSON.stringify(response, null, 2));
  const text = response.text;
  if (!text) throw new Error("Agent 1 returned empty response");
  return JSON.parse(text);
}

// ------------------------------------------------------------------
// AGENT 2: Deduplication & Clustering
// ------------------------------------------------------------------
export async function runAgent2(
  description: string, 
  lat: number, 
  lng: number, 
  category: string
) {
  // 1. Get embedding for new report (Gemini - text-embedding-004)
  const embeddingResponse = await callGeminiEmbedding(description);
  const newEmbedding = embeddingResponse.embeddings?.[0]?.values;
  if (!newEmbedding) throw new Error("Failed to get embedding");

  // 2. Fetch recent open issues from Firestore or Cache
  let issuesData: any[] = [];
  const now = Date.now();
  const cached = activeIssuesCache[category];
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`[Cache] Using cached active issues for category: ${category}`);
    issuesData = cached.data;
  } else {
    console.log(`[Cache] Fetching active issues from Firestore for category: ${category}`);
    if (dbAdmin) {
      try {
        const issuesSnapshot = await dbAdmin.collection('issues')
          .where('category', '==', category)
          .where('status', 'in', ['Reported', 'Community Verified', 'Acknowledged', 'In Progress'])
          .get();
        issuesData = issuesSnapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (dbErr) {
        console.error("[Pipeline] Firestore fetch in Agent 2 failed:", dbErr);
        issuesData = [];
      }
    } else {
      issuesData = [];
    }
    activeIssuesCache[category] = {
      data: issuesData,
      timestamp: now
    };
  }

  const radiusMap: Record<string, number> = {
    'pothole': 60,
    'garbage': 150,
    'streetlight': 100,
    'water_leakage': 80,
    'other': 100
  };
  const searchRadius = radiusMap[category] || 100;

  const candidateIssues = [];
  for (const issue of issuesData) {
    const distance = getDistance(lat, lng, issue.lat, issue.lng);
    if (distance <= searchRadius) {
      if (issue.embedding_vector) {
        const similarity = cosineSimilarity(newEmbedding, issue.embedding_vector);
        candidateIssues.push({
          issue_id: issue.id,
          auto_title: issue.auto_title,
          auto_description: issue.auto_description,
          similarity,
          distance
        });
      } else {
        candidateIssues.push({
          issue_id: issue.id,
          auto_title: issue.auto_title,
          auto_description: issue.auto_description,
          similarity: 0.5,
          distance
        });
      }
    }
  }

  if (candidateIssues.length === 0) {
    return { decision: 'create', matched_issue_id: null, similarity_score: 0, newEmbedding };
  }

  // Sort by similarity
  candidateIssues.sort((a, b) => b.similarity - a.similarity);
  const bestCandidate = candidateIssues[0];

  // 3. LLM Reasoning to confirm merge if similarity is high enough
  if (bestCandidate.similarity > 0.85) {
    const reasoningPrompt = `
You are an expert civic issue deduplication agent.
New Report Description: "${description}"
Existing Issue Title: "${bestCandidate.auto_title}"
Existing Issue Description: "${bestCandidate.auto_description}"
Distance between them: ${Math.round(bestCandidate.distance)} meters.

Determine if the New Report is referring to the exact same real-world issue as the Existing Issue.
Return a JSON object with:
- decision: "merge" or "create"
- reasoning: "short explanation"
`;

    const schema: any = {
      type: "OBJECT",
      properties: {
        decision: { type: "STRING", enum: ['merge', 'create'] },
        reasoning: { type: "STRING" }
      },
      required: ["decision", "reasoning"]
    };

    const mergeResponse = await callGeminiGenerate('gemini-3.1-flash-lite', {
      contents: [reasoningPrompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    });

    const mergeResult = JSON.parse(mergeResponse.text || '{}');
    if (mergeResult.decision === 'merge') {
      return { decision: 'merge', matched_issue_id: bestCandidate.issue_id, similarity_score: bestCandidate.similarity, newEmbedding };
    }
  }

  return { decision: 'create', matched_issue_id: null, similarity_score: bestCandidate.similarity, newEmbedding };
}

// ------------------------------------------------------------------
// AGENT 3: Severity & Urgency Scoring (Groq - llama-3.2-3b)
// ------------------------------------------------------------------
export async function runAgent3(
  category: string,
  auto_description: string,
  report_count: number,
  photoBase64?: string,
  mimeType?: string
) {
  const schema: any = {
    type: "OBJECT",
    properties: {
      urgency_score: { type: "NUMBER" },
      justification: { type: "STRING" }
    },
    required: ["urgency_score", "justification"]
  };

  const prompt = `Rate urgency 1-5 for civic issue. Category: ${category}, Desc: ${auto_description}, Reports: ${report_count}. Keep justification under 8 words.`;

  const contents: any[] = [prompt];
  if (photoBase64 && mimeType) {
    contents.push({ inlineData: { data: photoBase64, mimeType } });
  }

  const response = await callGeminiGenerate('gemini-3.1-flash-lite', {
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
      maxOutputTokens: 100
    }
  });

  const text = response.text;
  if (!text) throw new Error("Agent 3 returned empty response");
  return JSON.parse(text);
}
