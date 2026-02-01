// app/(auth)/login.tsx
import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);

  // 你終端機顯示 exp+faithflow://... 代表你們 scheme 很可能是 faithflow
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "faithflow",
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    (async () => {
      if (response?.type !== "success") return;

      try {
        setBusy(true);
        const { id_token } = response.params as any;
        if (!id_token) throw new Error("Missing id_token");

        const credential = GoogleAuthProvider.credential(id_token);
        await signInWithCredential(auth, credential);
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>登入</Text>

      <Pressable
        disabled={!request || busy}
        onPress={() => promptAsync()}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: "#111",
          opacity: !request || busy ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Text style={{ color: "white", textAlign: "center" }}>使用 Google 登入</Text>
        )}
      </Pressable>

      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        需要設定 Firebase 與 Google Client ID（EXPO_PUBLIC_ 開頭）
      </Text>
    </View>
  );
}
