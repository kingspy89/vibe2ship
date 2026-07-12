const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function run() {
  try {
    console.log("Sending POST request to http://localhost:3000/api/reports...");
    const res = await fetch("http://localhost:3000/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        photoBase64: dummyJpgBase64,
        mimeType: "image/jpeg",
        caption: "Test issue from automated testing script",
        lat: 12.9352,
        lng: 77.6245,
        userId: "test_user_123"
      })
    });
    
    console.log("Server responded with status:", res.status);
    const data = await res.json();
    console.log("Response JSON:", data);
  } catch (e: any) {
    console.error("Request failed:", e.message);
  }
}

run();
