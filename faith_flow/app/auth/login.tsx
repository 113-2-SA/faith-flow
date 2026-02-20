// app/auth/login.tsx
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const redirectUri = useMemo(() => {
    return AuthSession.makeRedirectUri({ preferLocalhost: true } as any);
  }, []);

  useEffect(() => {
    console.log("redirectUri =", redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    const url = (request as any)?.url as string | undefined;
    if (!url) return;

    console.log("authUrl =", url);

    try {
      const u = new URL(url);
      console.log("client_id =", u.searchParams.get("client_id"));
      console.log("redirect_uri =", u.searchParams.get("redirect_uri"));
    } catch (e) {
      console.log("parse authUrl failed:", e);
    }
  }, [request]);

  // 同步使用者到 PostgreSQL 的函式，50~80 行左右
  const syncUserToBackend = async (user: any) => {
    try {
      console.log("🔄 開始同步使用者到資料庫...");
      
      // 取得 Firebase ID Token
      const idToken = await user.getIdToken();
      
      // 呼叫後端 API
      const response = await fetch('http://localhost:3000/auth/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ PostgreSQL 同步成功:', data.user);
        return true;
      } else {
        console.error('❌ PostgreSQL 同步失敗:', data.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 同步錯誤:', error);
      return false;
    }
  };

  //  處理 Google 登入後，加上同步步驟 
  useEffect(() => {
    (async () => {
      if (!response) return;

      if (response.type !== "success") {
        setBusy(false);
        return;
      }

      try {
        setBusy(true);

        const idToken =
          (response.params as any)?.id_token ??
          (response.authentication as any)?.idToken;

        console.log("idToken exists?", !!idToken);
        if (!idToken) throw new Error("Missing id_token");

        // 步驟 1: Firebase 登入
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);

        console.log("✅ Firebase signed in uid =", userCred.user.uid);
        console.log("✅ Firebase signed in email =", userCred.user.email);
        console.log("✅ Firebase projectId =", (auth.app as any)?.options?.projectId);

        // 步驟 2: 同步到 PostgreSQL 
        const synced = await syncUserToBackend(userCred.user);
        
        if (synced) {
          console.log("✅ 完整登入流程成功（Firebase + PostgreSQL）");
        } else {
          console.warn("⚠️ Firebase 登入成功，但 PostgreSQL 同步失敗");
          // 你可以選擇是否繼續導航，或顯示錯誤訊息
        }

        // 步驟 3: 導航到主頁
        router.replace("/");

      } catch (e) {
        console.error("❌ Firebase signInWithCredential failed:", e);
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  const disabled = !request || busy || !webClientId;

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>登入</Text>

      {!webClientId ? (
        <Text style={{ color: "tomato" }}>
          缺少 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID（請檢查 .env）
        </Text>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={async () => {
          try {
            setBusy(true);
            const r: any = await promptAsync();
            if (r?.type !== "success") setBusy(false);
          } catch (e) {
            setBusy(false);
            console.error("promptAsync failed:", e);
          }
        }}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: "#111",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Text style={{ color: "white", textAlign: "center" }}>
            使用 Google 登入（Web）
          </Text>
        )}
      </Pressable>

      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        目前先以 Web（localhost:8081）測試。請把 console 印出的 redirectUri 加到
        Google Cloud 的 Authorized redirect URIs。
      </Text>
    </View>
  );
}