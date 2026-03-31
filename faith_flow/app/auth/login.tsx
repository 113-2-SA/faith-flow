// app/auth/login.tsx
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { GlassCard } from "../../components/GlassCard";
import { VideoBackground } from "../../components/VideoBackground";

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

        const idToken =
          (response.params as any)?.id_token ??
          (response.authentication as any)?.idToken;

        if (!idToken) throw new Error("Missing id_token");

        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);

        console.log("✅ Firebase signed in uid =", userCred.user.uid);
        console.log("✅ Firebase signed in email =", userCred.user.email);

        router.replace("/home"); // 登入完直接進月曆頁（Home）
      } catch (e) {
        console.error("❌ Firebase signInWithCredential failed:", e);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, router]);

  const disabled = !request || busy || !webClientId;

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>      
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <GlassCard style={{ padding: 20 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "rgba(255,255,255,0.95)",
              marginBottom: 12,
            }}
          >
            登入
          </Text>

          {!webClientId ? (
            <Text style={{ color: "tomato" }}>
              缺少 EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID（請檢查 .env）
            </Text>
          ) : null}

          <GlassCard
            style={{
              borderRadius: 14,
              marginTop: 14,
              opacity: disabled ? 0.6 : 1,
            }}
          >
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
              style={({ pressed }) => [
                {
                  padding: 14,
                  alignItems: "center",
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", textAlign: "center" }}>
                  使用 Google 登入（Web）
                </Text>
              )}
            </Pressable>
          </GlassCard>

          <Text
            style={{
              opacity: 0.7,
              fontSize: 12,
              marginTop: 12,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            Web 測試：redirectUri 以 console 印出的為準；Google Cloud 的 Authorized redirect URIs 要包含它。
          </Text>
        </GlassCard>
      </View>
    </VideoBackground>
  );
}

