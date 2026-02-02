// app/auth/login.tsx  （如果你實際是 app/(auth)/login.tsx 也一樣能用）
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useRouter } from "expo-router";

// ✅【新增】Firebase Auth：把 Google 回來的 id_token 轉成 Firebase 登入
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const router = useRouter();
  const [busy, setBusy] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // ✅ Web 測試：讓 redirect 走 localhost（比較不會變成 127.0.0.1）
  const redirectUri = useMemo(() => {
    // ✅【改動】用 as any 避免某些 TS 版本不認得 preferLocalhost
    return AuthSession.makeRedirectUri({ preferLocalhost: true } as any);
  }, []);

  // ✅（保留）印出 redirectUri：要加到 Google Cloud 的 Authorized redirect URIs
  useEffect(() => {
    console.log("redirectUri =", redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    redirectUri,
    // ✅（可選）一般會帶這些 scope，確保 profile/email 都拿得到
    scopes: ["openid", "profile", "email"],
  });

  // ✅【改動】把 request 的 debug 合併成一段（避免多段重複）
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

  // ✅【新增】處理 Google 回來的 response → 用 Firebase 實際登入
  useEffect(() => {
    (async () => {
      if (!response) return;

      // 使用者關閉/取消登入時，解除 busy，避免卡住
      if (response.type !== "success") {
        setBusy(false);
        return;
      }

      try {
        setBusy(true);

        // ✅【新增】兼容不同版本：id_token 可能在 params 或 authentication 裡
        const idToken =
          (response.params as any)?.id_token ??
          (response.authentication as any)?.idToken;

        console.log("idToken exists?", !!idToken);
        if (!idToken) throw new Error("Missing id_token");

        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        router.replace("/");


        // ✅ 登入成功後，Firebase Console(Authentication→使用者) 應該會出現這個 uid
        console.log("✅ Firebase signed in uid =", userCred.user.uid);
        console.log("✅ Firebase signed in email =", userCred.user.email);
        console.log("✅ Firebase projectId =", (auth.app as any)?.options?.projectId);
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
        // ✅【改動】避免 useProxy 型別問題；Web 測試不需要額外傳參數
        onPress={async () => {
          try {
            setBusy(true);
            const r: any = await promptAsync();
            // 若不是 success（例如關閉視窗），busy 要解除
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
