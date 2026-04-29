// app/auth/login.tsx
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth} from "../../lib/firebase";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GlassCard } from "../../components/GlassCard";
import { VideoBackground } from "../../components/VideoBackground";

WebBrowser.maybeCompleteAuthSession();

// SDK 54 正確判斷 Expo Go 的方式
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Expo Auth Proxy URL（expo-auth-session v7 移除 useProxy，需手動指定）
const EXPO_PROXY_REDIRECT = "https://auth.expo.io/@starxinxin/faith_flow";

export default function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  const redirectUri = useMemo(() => {
    if (Platform.OS === "web") {
      // Web：localhost redirect
      return AuthSession.makeRedirectUri({ preferLocalhost: true } as any);
    }
    if (isExpoGo) {
      // Expo Go：Proxy 服務仍可用，v7 只是不自動生成，手動指定即可
      // Google Cloud Console Web Client 需加入此 URI（已設定）
      return EXPO_PROXY_REDIRECT;
    }
    // 原生 build：iOS 走 reversed client ID scheme，Android 走 package scheme
    return AuthSession.makeRedirectUri({
      native: Platform.OS === "ios"
        ? "com.googleusercontent.apps.213812049105-1gi6t7i7o5ns23m4kocahtn3cdk8bgcs:/oauth2redirect/google"
        : `${process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}:/oauth2redirect/google`,
    } as any);
  }, []);

  useEffect(() => {
    console.log("isExpoGo =", isExpoGo);
    console.log("redirectUri =", redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // clientId 是 fallback：library 在 iOS 找不到 iosClientId 時會用這個
    // 避免 "iOS Client ID must be defined" 錯誤
    clientId: webClientId,
    webClientId,
    // 原生 build 才傳 iosClientId（Expo Go 的 proxy redirect 只接受 web client）
    iosClientId: isExpoGo ? undefined : iosClientId,
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

        router.replace("/home"); // 登入完直接進月曆頁（Home）
      } catch (e) {
        console.error("❌ 錯誤:", e);
      } finally {
        setBusy(false);
      }
    })();
  }, [response, router]);

  // 注意：sync 邏輯已由 AuthContext 的 onAuthStateChanged 統一處理，此處不重複


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
