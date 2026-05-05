import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { NotoSerifTC_400Regular } from "@expo-google-fonts/noto-serif-tc";
import { AuthProvider, useAuth } from "./context/authcontext";
import { AppShellProvider } from "../components/AppShell";
import { GlassThemeProvider } from "../context/GlassThemeContext";

/** 注入全域 CSS 與 Material Symbols 字體（web only） */
function GlobalWebStyles() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=menu,search";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      * { user-select: none !important; -webkit-user-select: none !important; }
      input, textarea, [contenteditable="true"] {
        user-select: text !important; -webkit-user-select: text !important;
      }
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);
  return null;
}

function RootLayoutNav() {
  const { currentUser, loading } = useAuth();
  const segments = useSegments();
  const inAuth = segments[0] === "auth";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!currentUser && !inAuth) return <Redirect href="/auth/login" />;
  if (currentUser && inAuth)   return <Redirect href="/home" />;

  if (currentUser) {
    return (
      <AppShellProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShellProvider>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ NotoSerifTC_400Regular });

  // 字體載完後同步設定，確保所有 Text 在首次渲染時就套用
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // 在任何 Text 渲染前同步設定全域字體
  if (!Text.defaultProps) Text.defaultProps = {};
  (Text.defaultProps as any).style = { fontFamily: "NotoSerifTC_400Regular" };

  return (
    <GlassThemeProvider>
      <AuthProvider>
        <GlobalWebStyles />
        <RootLayoutNav />
      </AuthProvider>
    </GlassThemeProvider>
  );
}
