import dotenv from "dotenv";
dotenv.config();

import { runAgent1, runAgent2, runAgent3 } from "./server/pipeline";

// 1x1 transparent dummy JPEG
const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function test() {
  try {
    console.log("Starting full pipeline local test...");
    console.log("Checking GEMINI_API_KEY environment variable:", process.env.GEMINI_API_KEY ? "FOUND" : "NOT FOUND");
    
    console.log("\n--- Testing Agent 1 (Gemini Vision Triage) ---");
    const agent1 = await runAgent1(dummyJpgBase64, "image/jpeg", "A pothole in the middle of Koramangala road");
    console.log("Agent 1 Result:", agent1);

    console.log("\n--- Testing Agent 2 (Gemini Embeddings + Proximity check) ---");
    const agent2 = await runAgent2(agent1.auto_description, 12.9352, 77.6245, agent1.category);
    console.log("Agent 2 Result:", agent2);

    console.log("\n--- Testing Agent 3 (Urgency Scoring text-only) ---");
    const agent3 = await runAgent3(agent1.category, agent1.auto_description, 1);
    console.log("Agent 3 Result:", agent3);

    console.log("\nPipeline test completed successfully!");
    process.exit(0);
  } catch (e: any) {
    console.error("\nPipeline test failed with error:", e);
    process.exit(1);
  }
}

test();
