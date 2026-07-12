import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import localConfig from '../firebase-applet-config.json';

let config: {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  firestoreDatabaseId: string;
};

// 1. Try loading from a single FIREBASE_CONFIG_JSON environment variable
if (process.env.FIREBASE_CONFIG_JSON) {
  try {
    config = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
    console.log('[Firebase] Initialized using FIREBASE_CONFIG_JSON env variable.');
  } catch (err) {
    console.error('[Firebase] Failed to parse FIREBASE_CONFIG_JSON:', err);
    throw err;
  }
} 
// 2. Try loading from individual environment variables
else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY) {
  config = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID || '',
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || '',
  };
  console.log('[Firebase] Initialized using individual environment variables.');
} 
// 3. Fall back to statically bundled config file
else {
  config = localConfig;
  console.log('[Firebase] Initialized using bundled firebase-applet-config.json.');
}

const app = initializeApp({
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  storageBucket: config.storageBucket,
});

export const dbAdmin = getFirestore(app, config.firestoreDatabaseId);
