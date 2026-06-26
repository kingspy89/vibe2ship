import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const dbAdmin = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    const d = doc(collection(dbAdmin, 'test_collection'));
    await setDoc(d, { test: true });
    console.log("Write success!");
    
    const snap = await getDocs(collection(dbAdmin, 'test_collection'));
    console.log("Read success! Docs:", snap.size);
    process.exit(0);
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
test();
