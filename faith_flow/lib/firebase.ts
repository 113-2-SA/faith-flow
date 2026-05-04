import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyC93pS3h4kkd7rd8qjVOdmSIRXNX3R2hGQ",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "faith-flow-82991.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "faith-flow-82991",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "faith-flow-82991.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "213812049105",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:213812049105:web:b5ef8f2db8e613429d81f0",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);