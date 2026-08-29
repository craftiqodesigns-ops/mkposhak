import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseAppletConfig from './firebase-applet-config.json';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  measurementId: firebaseAppletConfig.measurementId
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it
export const auth = getAuth(app);

// Firestore settings:
// - ignoreUndefinedProperties: fields left blank (e.g. an item's subCategory, a
//   customer's mobile number) get sent as `undefined`, which Firestore otherwise
//   rejects outright ("Failed to save item"/"Unsupported field value: undefined").
//   This tells Firestore to silently drop those fields instead of erroring.
// - experimentalAutoDetectLongPolling: some networks (proxies, certain mobile
//   carriers, antivirus/browser extensions) break Firestore's default streaming
//   connection, causing writes to hang forever on "Saving...". This makes Firestore
//   automatically fall back to long-polling when that happens.
const firestoreSettings = {
  ignoreUndefinedProperties: true,
  experimentalAutoDetectLongPolling: true,
};

// Initialize Firebase Firestore with named database ID and export it
export const db = firebaseAppletConfig.firestoreDatabaseId && firebaseAppletConfig.firestoreDatabaseId !== '(default)'
  ? initializeFirestore(app, firestoreSettings, firebaseAppletConfig.firestoreDatabaseId)
  : initializeFirestore(app, firestoreSettings);

