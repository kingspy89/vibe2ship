import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.projectId,
});

const dbAdmin = getFirestore(app, config.firestoreDatabaseId);

async function seed() {
  const batch = dbAdmin.batch();
  const clusters = [
    { lat: 12.9352, lng: 77.6245, category: 'pothole', title: 'Severe Pothole near Signal', desc: 'Large crater in the middle of the road causing traffic slowdowns.' },
    { lat: 12.9348, lng: 77.6250, category: 'garbage', title: 'Overflowing dump bin', desc: 'Garbage hasn\'t been collected for 3 days, spilling onto sidewalk.' },
    { lat: 12.9360, lng: 77.6240, category: 'streetlight', title: 'Streetlight out', desc: 'Pitch black crossing, very dangerous at night.' },
    { lat: 12.9340, lng: 77.6235, category: 'water_leakage', title: 'Water pipe burst', desc: 'Water leaking out of a broken underground pipe onto the road.' },
    { lat: 12.9365, lng: 77.6255, category: 'pothole', title: 'Multiple small potholes', desc: 'Stretch of road has completely degraded.' },
  ];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const issueRef = dbAdmin.collection('issues').doc();
    batch.set(issueRef, {
      category: cluster.category,
      auto_title: cluster.title,
      auto_description: cluster.desc,
      lat: cluster.lat,
      lng: cluster.lng,
      severity_score: Math.floor(Math.random() * 3) + 2,
      severity_justification: 'AI deemed this a safety hazard based on typical patterns.',
      status: 'Reported',
      report_count: 5 + i * 3,
      priority_score: 4 * Math.log(5 + i * 3 + 1),
      created_at: Date.now() - 1000000,
      updated_at: Date.now(),
    });
  }
  await batch.commit();
  console.log("Seeded successfully");
}

seed().catch(console.error);
