import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider ,useAuth} from "./context/authcontext"  
// import { useAuth } from "../hooks/useAuth";
import { AppShellProvider } from "../components/AppShell";


/**
 * ⭐ 內部路由保護元件
 * 這個元件在 AuthProvider 內部，所以可以使用 useAuth()
 */
function RootLayoutNav() {
  const { currentUser, loading } = useAuth();  // ⭐ 從 AuthContext 取得
  const segments = useSegments();

  const inAuth = segments[0] === "auth";

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

  // ✅ 關鍵：已登入且還在 auth 區，導去 /home（月曆頁）
  if (currentUser && inAuth) {
    return <Redirect href="/home" />;
  }

  // 已登入的情況，用共用 Layout 包裹（含側邊欄）
  if (currentUser) {
    return (
      <AppShellProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShellProvider>
    );
  }

  // 未登入但仍在 auth 區（登入頁）
  return <Stack screenOptions={{ headerShown: false }} />;
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
