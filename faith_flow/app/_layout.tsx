import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./context/authcontext"  


/**
 * ⭐ 內部路由保護元件
 * 這個元件在 AuthProvider 內部，所以可以使用 useAuth()
 */
function RootLayoutNav() {
  const { currentUser, loading } = useAuth();  // ⭐ 從 AuthContext 取得
  const segments = useSegments();

  const inAuth = segments[0] === "auth"; // 你的登入頁在 /auth/login

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // 未登入：只在「不在 auth 區」時才導去 login（避免 loop）
  if (!currentUser && !inAuth) {
    return <Redirect href="/auth/login" />;
  }

  // 已登入：如果還在 auth 區（login 頁），就導回首頁
  if (currentUser && inAuth) {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ title: "登入" }} />
      {/* 如果有其他路由，在這裡加 */}
    </Stack>
  );
}

/**
 * ⭐ 根元件
 * 用 AuthProvider 包裹整個 App
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
