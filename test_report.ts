import fs from 'fs';
import path from 'path';

async function testReport() {
  const payload = {
    photoBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', // 1x1 pixel image
    mimeType: 'image/png',
    caption: 'A small test pothole',
    lat: 12.9352,
    lng: 77.6245,
    userId: 'test_user_id',
    photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  };

  try {
    const res = await fetch('http://localhost:3000/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testReport();
