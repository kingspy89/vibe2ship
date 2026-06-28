import { GoogleGenAI, Type, Schema } from "@google/genai";
import { dbAdmin } from "./firebaseAdmin";
import { collection, getDocs, query, where } from "firebase/firestore";

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

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
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
// AGENT 1: Vision Categorization
// ------------------------------------------------------------------
export async function runAgent1(photoBase64: string, mimeType: string, caption?: string) {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        enum: ['pothole', 'streetlight', 'garbage', 'water_leakage', 'other'],
        description: "The primary category of the issue shown in the image."
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence score between 0.0 and 1.0"
      },
      auto_title: {
        type: Type.STRING,
        description: "A short, clear title for this issue."
      },
      auto_description: {
        type: Type.STRING,
        description: "A 1-2 sentence description of the issue."
      },
      severity_signal: {
        type: Type.NUMBER,
        description: "A preliminary severity signal from 1 (low) to 5 (high) based purely on visual appearance."
      }
    },
    required: ["category", "confidence", "auto_title", "auto_description", "severity_signal"]
  };

  const prompt = `You are an AI assistant for a civic issue reporting platform. Analyze the provided image and caption. Categorize the issue, provide a title, a short description, and a preliminary severity score.
Caption provided by user: "${caption || 'None'}"`;

  const response = await getAI().models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      prompt,
      {
        inlineData: {
          data: photoBase64,
          mimeType: mimeType
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  });

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
  // 1. Get embedding for new report
  const embeddingResponse = await getAI().models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: description,
  });
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
    const issuesQuery = query(
      collection(dbAdmin, 'issues'),
      where('category', '==', category),
      where('status', 'in', ['Reported', 'Community Verified', 'Acknowledged', 'In Progress'])
    );
    const issuesSnapshot = await getDocs(issuesQuery);
    issuesData = issuesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
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
  for (const data of issuesData) {
    const distance = getDistance(lat, lng, data.lat, data.lng);
    if (distance <= searchRadius) {
      // Need the embedding of this issue. We will store embeddings on the issue doc or recalculate.
      // For simplicity, we assume 'embedding_vector' is on the issue doc, representing the primary description.
      if (data.embedding_vector && data.embedding_vector.length > 0) {
        const sim = cosineSimilarity(newEmbedding, data.embedding_vector);
        candidateIssues.push({
          issue_id: data.id,
          distance,
          similarity: sim,
          auto_title: data.auto_title,
          auto_description: data.auto_description
        });
      }
    }
  }

  // If no candidates, create
  if (candidateIssues.length === 0) {
    return { decision: 'create', matched_issue_id: null, similarity_score: 0, newEmbedding };
  }

  // Sort by similarity
  candidateIssues.sort((a, b) => b.similarity - a.similarity);
  const bestCandidate = candidateIssues[0];

  // 3. LLM Reasoning to confirm merge if similarity is high enough
  if (bestCandidate.similarity > 0.85) {
    // Almost certain match based on embedding, but let's do a quick LLM check just in case, or just auto-merge.
    // The prompt says "let the agent reason over both image description and proximity"
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

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        decision: { type: Type.STRING, enum: ['merge', 'create'] },
        reasoning: { type: Type.STRING }
      },
      required: ["decision", "reasoning"]
    };

    const mergeResponse = await getAI().models.generateContent({
      model: 'gemini-3.1-flash-lite', // fast reasoning
      contents: reasoningPrompt,
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
// AGENT 3: Severity & Urgency Scoring
// ------------------------------------------------------------------
export async function runAgent3(
  category: string,
  auto_description: string,
  report_count: number,
  photoBase64: string,
  mimeType: string
) {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      urgency_score: { type: Type.NUMBER, description: "1 to 5, where 5 is critical/immediate danger." },
      justification: { type: Type.STRING, description: "Short human-readable justification for the score." }
    },
    required: ["urgency_score", "justification"]
  };

  const prompt = `You are a civic issue triage agent. Assign an urgency score (1-5) and a short justification based on the provided issue details and image.
Category: ${category}
Description: ${auto_description}
Report Count: ${report_count} (higher report count implies wider impact)

Scoring Rubric (1-5):
1 - Minor annoyance, no safety risk (e.g., small litter, minor cosmetic damage).
2 - Noticeable issue, low immediate risk (e.g., street light out in a non-critical area).
3 - Moderate impact, needs addressing soon (e.g., medium pothole, moderate water leak).
4 - Significant hazard or major disruption (e.g., large deep pothole, major water main leak, exposed wires).
5 - Critical emergency, immediate threat to life/property (e.g., live sparking wire on sidewalk, sinkhole).

Return the JSON output.`;

  const response = await getAI().models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [
      prompt,
      {
        inlineData: {
          data: photoBase64,
          mimeType: mimeType
        }
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  });

  return JSON.parse(response.text || '{}');
}
