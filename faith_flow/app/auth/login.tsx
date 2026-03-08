// app/auth/login.tsx
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from "firebase/auth";
import { auth} from "../../lib/firebase";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // Web 用 preferLocalhost；未來手機端可用 scheme（先留好路）
  const redirectUri = useMemo(() => {
    if (Platform.OS === "web") {
      return AuthSession.makeRedirectUri({ preferLocalhost: true } as any);
    }
    return AuthSession.makeRedirectUri({ scheme: "faithflow" } as any);
  }, []);

  useEffect(() => {
    console.log("redirectUri =", redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });

  // Debug：只在 Web 印出（避免未來跑手機出現 URL 不支援等問題）
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const url = (request as any)?.url as string | undefined;
    if (!url) return;
    console.log("authUrl =", url);

  // ⭐ 處理 Google 登入（AuthContext 會自動處理同步）
    try {
      const u = new URL(url);
      console.log("client_id =", u.searchParams.get("client_id"));
      console.log("redirect_uri =", u.searchParams.get("redirect_uri"));
    } catch (e) {
      console.log("parse authUrl failed:", e);
    }
  }, [request]);

  useEffect(() => {
    (async () => {
      if (!response) return;

      if (response.type !== "success") {
        setBusy(false);
        return;
      }

      try {
        setBusy(true);

        const idToken = (response.params as any)?.id_token ?? 
                        (response.authentication as any)?.idToken;

        console.log('========== 登入流程開始 ==========');
        console.log('1. ✅ 取得 ID Token:', idToken ? '有' : '沒有');

        if (!idToken) throw new Error("Missing id_token");

        // ⭐ Firebase 登入（AuthContext 的 onAuthStateChanged 會自動觸發同步）
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);

        console.log('2. ✅ Firebase 登入成功');
        console.log('   - UID:', userCred.user.uid);
        console.log('   - Email:', userCred.user.email);
        console.log('   - AuthContext 會自動同步到 PostgreSQL');

        console.log('========== 登入流程結束 ==========');

        // 導航到主頁
        router.replace("/");

      } catch (e) {
        console.error("❌ 錯誤:", e);
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const idToken = await user.getIdToken();
      
      await fetch('http://localhost:3000/api/auth/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
    }
  });
  return unsubscribe;
}, []);


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
        Web 測試：redirectUri 以 console 印出的為準；Google Cloud 的 Authorized redirect URIs 要包含它。
      </Text>
    </View>
  );
}