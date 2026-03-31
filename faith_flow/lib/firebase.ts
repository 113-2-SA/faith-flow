// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// 手機用 AsyncStorage 持久化；Web 用預設 localStorage
// 用 try/catch 防止熱重載時 initializeAuth 重複呼叫報錯
function createAuth() {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    // Auth 已初始化（熱重載場景），直接取得現有實例
    return getAuth(app);
  }
}

export const auth = createAuth();

export const db = getFirestore(app);
