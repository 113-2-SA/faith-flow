// app/_layout.tsx
import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  // 你的 login 路徑是 /auth/login（因為資料夾叫 app/auth）
  const inAuthRoute = segments[0] === "auth";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // 未登入：只在「不在 auth 區」時才導去 login（避免 loop）
  if (!user && !inAuthRoute) {
    return <Redirect href="/auth/login" />;
  }

  // 已登入：如果還在 auth 區（login 頁），就導回首頁
  if (user && inAuthRoute) {
    return <Redirect href="/" />;
  }

  return <Stack />;
}
