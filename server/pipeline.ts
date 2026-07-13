import { dbAdmin } from "./firebaseAdmin.js";

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

let aiClient: any = null;

async function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    // Dynamically load to prevent CommonJS/ESM boot-time loader errors on Vercel
    const { GoogleGenAI } = await import("@google/genai");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function callGeminiWithRetry(
  model: string,
  options: any,
  action: 'generateContent' | 'embedContent' = 'generateContent',
  retries = 4,
  delay = 2000
): Promise<any> {
  try {
    const ai = await getAI();
    if (action === 'embedContent') {
      return await ai.models.embedContent({ model, ...options });
    } else {
      return await ai.models.generateContent({ model, ...options });
    }
  } catch (err: any) {
    const status = err.status || (err.error && err.error.code);
    const message = err.message || '';
    const isTransient = status === 429 || status === 503 || message.includes('fetch failed') || message.includes('demand') || message.includes('UNAVAILABLE') || message.includes('Unavailable');

    if (retries > 0 && isTransient) {
      console.warn(`[Gemini API] Rate limit / transient error (${status || 'unknown'}). Retrying ${model} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiWithRetry(model, options, action, retries - 1, delay * 2);
    }

    // If the primary generation model failed, try backup model gemini-2.0-flash
    if (model === 'gemini-2.0-flash-lite') {
      console.warn(`[Gemini API] Lite model gemini-2.0-flash-lite failed. Falling back to gemini-2.0-flash...`);
      return callGeminiWithRetry('gemini-2.0-flash', options, action, 1, 1000);
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
// AGENT 1: Vision Categorization
// ------------------------------------------------------------------
export async function runAgent1(photoBase64: string, mimeType: string, caption?: string) {
  const schema: any = {
    type: "OBJECT",
    properties: {
      category: {
        type: "STRING",
        enum: ['pothole', 'streetlight', 'garbage', 'water_leakage', 'other'],
        description: "The primary category of the issue shown in the image."
      },
      confidence: {
        type: "NUMBER",
        description: "Confidence score between 0.0 and 1.0"
      },
      auto_title: {
        type: "STRING",
        description: "A short, clear title for this issue."
      },
      auto_description: {
        type: "STRING",
        description: "A 1-2 sentence description of the issue."
      },
      severity_signal: {
        type: "NUMBER",
        description: "A preliminary severity signal from 1 (low) to 5 (high) based purely on visual appearance."
      },
      severity_justification: {
        type: "STRING",
        description: "A short justification explaining why this severity score was given."
      }
    },
    required: ["category", "confidence", "auto_title", "auto_description", "severity_signal", "severity_justification"]
  };

  const prompt = `Categorize civic issue image. Caption: "${caption || 'None'}". Keep title and description ultra-concise (under 10 words).`;

  const response = await callGeminiWithRetry('gemini-2.0-flash-lite', {
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
      temperature: 0.1,
      maxOutputTokens: 120
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
  const embeddingResponse = await callGeminiWithRetry('text-embedding-004', {
    contents: description,
  }, 'embedContent');
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

    const mergeResponse = await callGeminiWithRetry('gemini-2.5-flash', {
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
  photoBase64?: string,
  mimeType?: string
) {
  const schema: any = {
    type: "OBJECT",
    properties: {
      urgency_score: { type: "NUMBER", description: "1 to 5, where 5 is critical/immediate danger." },
      justification: { type: "STRING", description: "Short human-readable justification for the score." }
    },
    required: ["urgency_score", "justification"]
  };

  const prompt = `Rate urgency (1-5) and short justification (1 sentence) for civic report. Category: ${category}, Desc: ${auto_description}, Reports: ${report_count}.`;

  const contents: any[] = [prompt];
  if (photoBase64 && mimeType) {
    contents.push({
      inlineData: {
        data: photoBase64,
        mimeType: mimeType
      }
    });
  }

  const response = await callGeminiWithRetry('gemini-2.0-flash-lite', {
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1,
      maxOutputTokens: 80
    }
  });

  return JSON.parse(response.text || '{}');
}
