// src/firebase.js
//
// Initializes Firebase and exports the services the app uses.
//
// The config lives in environment variables so the old and new projects
// can be swapped without editing source — copy .env.example to
// .env.local and paste in the values from the Firebase console
// (Project settings > General > Your apps).
//
// NOT A SECRET: every one of these values ships inside the JavaScript
// bundle and is visible to anyone who opens devtools. That is by design
// — a Firebase web config identifies the project, it doesn't authorize
// anything. What actually protects your data is firestore.rules and
// storage.rules. The env vars are here for convenience, not secrecy.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Create React App inlines env vars at BUILD time and leaves anything
// missing as undefined, which Firebase then reports much later as a
// confusing auth/network error. Fail loudly and early instead.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  throw new Error(
    `Firebase config is missing: ${missing.join(", ")}. ` +
      "Copy .env.example to .env.local, fill in the values from the " +
      "Firebase console, then restart the dev server (env vars are read " +
      "at startup, so a running `npm start` won't pick them up)."
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// NOTE: Firebase Storage is available on Blaze, but recitation audio
// still goes to Cloudinary — that path already works and is free. See
// src/services/audioStorage.js. storage.rules is kept ready in case
// that changes.

export default app;
