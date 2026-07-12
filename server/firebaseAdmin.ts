import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import localConfig from '../firebase-applet-config';

let config: {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  firestoreDatabaseId: string;
};

const configJson = process.env.FIREBASE_CONFIG_JSON;
let parsedConfig: typeof config | null = null;
if (configJson) {
  try {
    parsedConfig = JSON.parse(configJson);
    console.log('[Firebase] Initialized using FIREBASE_CONFIG_JSON env variable.');
  } catch (err) {
    console.error('[Firebase] Failed to parse FIREBASE_CONFIG_JSON. Falling back to other config sources:', err);
  }
}

// 1. Prefer valid FIREBASE_CONFIG_JSON
if (parsedConfig) {
  config = parsedConfig;
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
  console.log('[Firebase] Initialized using bundled firebase-applet-config.');
}

let app: any;
try {
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp({
      projectId: config.projectId,
    });
  } else {
    app = getApp();
  }
} catch (e) {
  console.error('[Firebase] Failed to initialize Admin App:', e);
}

let dbAdmin: any = null;
try {
  if (app) {
    dbAdmin = getFirestore(app);
  }
} catch (e) {
  console.error('[Firebase] Failed to initialize Firestore dbAdmin:', e);
}

export { dbAdmin };
