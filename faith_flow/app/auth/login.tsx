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
  }, [request]);

  // ⭐ 處理 Google 登入（AuthContext 會自動處理同步）
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