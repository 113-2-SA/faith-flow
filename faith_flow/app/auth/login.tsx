// app/auth/login.tsx
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { GlassCard } from "../../components/GlassCard";
import { VideoBackground } from "../../components/VideoBackground";

WebBrowser.maybeCompleteAuthSession();

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  const redirectUri = useMemo(() => {
    if (Platform.OS === "web") {
      return AuthSession.makeRedirectUri({ preferLocalhost: true } as any);
    }
    if (isExpoGo) {
      const devUri = process.env.EXPO_PUBLIC_DEV_REDIRECT_URI;
      if (devUri) return devUri;
      return AuthSession.makeRedirectUri();
    }
    return AuthSession.makeRedirectUri({
      native: Platform.OS === "ios"
        ? "com.googleusercontent.apps.213812049105-1gi6t7i7o5ns23m4kocahtn3cdk8bgcs:/oauth2redirect/google"
        : `${process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID}:/oauth2redirect/google`,
    } as any);
  }, []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    webClientId
      ? {
          clientId: webClientId,
          webClientId,
          iosClientId: isExpoGo ? undefined : iosClientId,
          redirectUri,
          scopes: ["openid", "profile", "email"],
        }
      : (null as any)
  );

  useEffect(() => {
    (async () => {
      if (!response || response.type !== "success") return;
      try {
        setBusy(true);
        const idToken =
          (response.params as any)?.id_token ??
          (response.authentication as any)?.idToken;
        if (!idToken) throw new Error("Missing id_token");
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        // _layout.tsx 的 <Redirect href="/home" /> 會自動處理跳轉
      } catch (e) {
        console.error("Google 登入失敗:", e);
        setError("Google 登入失敗，請再試一次");
      } finally {
        setBusy(false);
      }
    })();
  }, [response, router]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setError("請輸入電子郵件和密碼");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // _layout.tsx 的 <Redirect href="/home" /> 會自動處理跳轉
    } catch (e: any) {
      const msg: Record<string, string> = {
        "auth/user-not-found": "找不到此帳號",
        "auth/wrong-password": "密碼錯誤",
        "auth/invalid-email": "電子郵件格式不正確",
        "auth/email-already-in-use": "此電子郵件已被註冊",
        "auth/weak-password": "密碼至少需要 6 個字元",
        "auth/invalid-credential": "帳號或密碼錯誤",
      };
      setError(msg[e.code] ?? "登入失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  };

  const googleDisabled = !request || busy || !webClientId;

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={Keyboard.dismiss}
        />
        <GlassCard style={{ padding: 20 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "rgba(255,255,255,0.95)",
              marginBottom: 16,
            }}
          >
            {mode === "login" ? "登入" : "註冊"}
          </Text>

          {/* Email 輸入 */}
          <TextInput
            placeholder="電子郵件"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: 12,
              color: "white",
              marginBottom: 10,
            }}
          />

          {/* 密碼輸入 */}
          <TextInput
            placeholder="密碼"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: 12,
              color: "white",
              marginBottom: 10,
            }}
          />

          {/* 錯誤提示 */}
          {error ? (
            <Text style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>
              {error}
            </Text>
          ) : null}

          {/* 登入 / 註冊按鈕 */}
          <GlassCard style={{ borderRadius: 10, marginBottom: 10 }}>
            <Pressable
              disabled={busy}
              onPress={handleEmailAuth}
              style={({ pressed }) => ({
                padding: 14,
                alignItems: "center",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "600" }}>
                  {mode === "login" ? "登入" : "建立帳號"}
                </Text>
              )}
            </Pressable>
          </GlassCard>

          {/* 切換登入 / 註冊 */}
          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{ alignItems: "center", marginBottom: 16 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              {mode === "login" ? "還沒有帳號？點此註冊" : "已有帳號？點此登入"}
            </Text>
          </Pressable>

          {/* 分隔線 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <Text style={{ color: "rgba(255,255,255,0.4)", marginHorizontal: 8, fontSize: 12 }}>
              或
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
          </View>

          {/* Google 登入（APK 才能用） */}
          <GlassCard
            style={{
              borderRadius: 10,
              opacity: googleDisabled ? 0.4 : 1,
            }}
          >
            <Pressable
              disabled={googleDisabled}
              onPress={async () => {
                try {
                  setBusy(true);
                  setError("");
                  const r: any = await promptAsync();
                  if (r?.type !== "success") setBusy(false);
                } catch (e) {
                  setBusy(false);
                  console.error("promptAsync failed:", e);
                }
              }}
              style={({ pressed }) => ({
                padding: 14,
                alignItems: "center",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text style={{ color: "white" }}>使用 Google 登入</Text>
            </Pressable>
          </GlassCard>

          {isExpoGo && (
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 8, textAlign: "center" }}>
              Google 登入需 APK 版本
            </Text>
          )}
        </GlassCard>
      </View>
    </VideoBackground>
  );
}
