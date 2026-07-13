import dotenv from "dotenv";
dotenv.config();
import { dbAdmin } from "../server/firebaseAdmin.js";

async function inspectDB() {
  if (!dbAdmin) {
    console.error("dbAdmin is null!");
    return;
  }
  
  try {
    console.log("Fetching latest issues...");
    const issuesSnap = await dbAdmin.collection('issues')
      .orderBy('created_at', 'desc')
      .limit(3)
      .get();
      
    console.log(`Found ${issuesSnap.size} issues:`);
    issuesSnap.forEach((doc: any) => {
      const data = doc.data();
      console.log(`\nIssue ID: ${doc.id}`);
      console.log(`Title: ${data.auto_title}`);
      console.log(`Category: ${data.category}`);
      console.log(`Severity: ${data.severity_score}`);
      console.log(`Created at: ${new Date(data.created_at).toISOString()}`);
    });

    console.log("\nFetching latest reports...");
    const reportsSnap = await dbAdmin.collection('reports')
      .orderBy('created_at', 'desc')
      .limit(3)
      .get();
      
    console.log(`Found ${reportsSnap.size} reports:`);
    reportsSnap.forEach((doc: any) => {
      const data = doc.data();
      console.log(`\nReport ID: ${doc.id}`);
      console.log("Raw Report Data:", JSON.stringify(data, null, 2));
    });
  } catch (e: any) {
    console.error("Firestore inspection failed:", e.message);
  }
}

inspectDB();
