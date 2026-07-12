import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

const app = initializeApp({
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  storageBucket: config.storageBucket,
});

export const dbAdmin = getFirestore(app, config.firestoreDatabaseId);
