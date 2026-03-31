import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { AppShellProvider } from "../components/AppShell";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  const inAuth = segments[0] === "auth";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user && !inAuth) {
    return <Redirect href="/auth/login" />;
  }

  // ✅ 關鍵：已登入且還在 auth 區，導去 /home（月曆頁）
  if (user && inAuth) {
    return <Redirect href="/home" />;
  }

  // 已登入的情況，用共用 Layout 包裹（含側邊欄）
  if (user) {
    return (
      <AppShellProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShellProvider>
    );
  }

  // 未登入但仍在 auth 區（登入頁）
  return <Stack screenOptions={{ headerShown: false }} />;
}

