// hooks/useAuth.ts
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import Constants from 'expo-constants';
import { auth } from "../lib/firebase";

// ⭐ 智慧判斷 API URL
function getApiUrl() {
  // 正式環境
  if (!__DEV__) {
    return 'https://api.your-domain.com';
  }
  
  // 開發環境：自動偵測
  const debuggerHost = Constants.expoConfig?.hostUri;
  
  if (debuggerHost) {
    // 從 Metro Bundler 的位址自動取得 IP
    // 例如：192.168.1.100:8081 → http://192.168.1.100:3000
    const host = debuggerHost.split(':')[0];
    const apiUrl = `http://${host}:3000`;
    
    console.log('📱 偵測到 Expo DevServer:', debuggerHost);
    console.log('🌐 使用 API URL:', apiUrl);
    
    return apiUrl;
  }
  
  // Fallback
  return 'http://localhost:3000';
}

const API_URL = getApiUrl();

/**
 * 同步使用者到 PostgreSQL 資料庫
 */
async function syncUserToDatabase(user: User): Promise<boolean> {
  try {
    console.log("[syncUserToDatabase] 開始同步使用者到資料庫...");
    console.log("[syncUserToDatabase] API URL:", API_URL);
    console.log("[syncUserToDatabase] UID:", user.uid);
    console.log("[syncUserToDatabase] Email:", user.email);

    const idToken = await user.getIdToken();
    console.log("[syncUserToDatabase] ✅ 已取得 ID Token");

    const response = await fetch(`${API_URL}/api/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("[syncUserToDatabase] ❌ 同步失敗:", data.error);
      return false;
    }

    console.log("[syncUserToDatabase] ✅ 同步成功!");
    console.log("[syncUserToDatabase] 使用者資料:", data.user);
    return true;

  } catch (error) {
    console.error("[syncUserToDatabase] ❌ 同步錯誤:", error);
    return false;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        console.log("\n========== 使用者登入事件 ==========");
        console.log("UID:", u.uid);
        console.log("Email:", u.email);
        console.log("準備同步到資料庫...");
        
        await syncUserToDatabase(u);
        
        console.log("========== 同步完成 ==========\n");
      } else {
        console.log("使用者已登出");
      }
      
      setLoading(false);
    });
    
    return unsub;
  }, []);

  return { user, loading };
}