import dotenv from "dotenv";
dotenv.config();

const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function testReportWithImage() {
  try {
    console.log("Sending POST request to local server...");
    const res = await fetch("http://localhost:3000/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        photoBase64: dummyJpgBase64,
        mimeType: "image/jpeg",
        caption: "Test report with image payload",
        lat: 12.9352,
        lng: 77.6245,
        userId: "test_user_image"
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (data.success && data.issue_id) {
      console.log(`\nVerifying database entry for issue: ${data.issue_id}...`);
      const { dbAdmin } = await import("../server/firebaseAdmin.js");
      if (dbAdmin) {
        const reportsSnap = await dbAdmin.collection('reports')
          .where('issue_id', '==', data.issue_id)
          .get();
          
        console.log(`Found ${reportsSnap.size} reports associated with this issue.`);
        reportsSnap.forEach((doc: any) => {
          const reportData = doc.data();
          console.log(`Report ID: ${doc.id}`);
          console.log(`Photo URL length: ${reportData.photo_url ? reportData.photo_url.length : 0}`);
          console.log(`Photo URL preview: ${reportData.photo_url ? reportData.photo_url.substring(0, 50) : "empty"}`);
        });
      }
    }
  } catch (e: any) {
    console.error("Test failed:", e.message);
  }
}

testReportWithImage();
