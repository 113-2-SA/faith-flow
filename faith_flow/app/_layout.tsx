import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  const inAuth = segments[0] === "auth"; // 你的登入頁在 /auth/login

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // 未登入：只有不在 auth 區才導去 login（避免 loop）
  if (!user && !inAuth) {
    return <Redirect href={"/auth/login" as any} />;
  }

  // ✅ 關鍵：已登入且還在 auth 區，導去 /settings（你要錄 Demo 的動線）
  if (user && inAuth) {
    return <Redirect href={"/settings" as any} />;
  }

  return <Stack />;
}

