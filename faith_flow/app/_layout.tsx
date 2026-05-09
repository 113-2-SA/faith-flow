import { Redirect, Stack, useSegments } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { NotoSerifTC_400Regular } from "@expo-google-fonts/noto-serif-tc";
import { AuthProvider, useAuth } from "./context/authcontext";
import { AppShellProvider } from "../components/AppShell";
import { CopilotProvider } from "react-native-copilot";
import { GlassThemeProvider } from "../context/GlassThemeContext";

/** 注入全域 CSS（web only） */
function GlobalWebStyles() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const style = document.createElement("style");
    style.textContent = `
      * { user-select: none !important; -webkit-user-select: none !important; scrollbar-width: none; }
      input, textarea, [contenteditable="true"] {
        user-select: text !important; -webkit-user-select: text !important;
      }
      ::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
    return () => {
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
      <CopilotProvider
        animated
        overlay="view"
        stopOnOutsideClick
        backdropColor="transparent"
        labels={{ skip: "略過", previous: "上一步", next: "下一步", finish: "完成" }}
      >
        <AppShellProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AppShellProvider>
      </CopilotProvider>
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
  // 注意：在新版 React Native 中，Text.defaultProps 已被移除
  // 字體設置通過 useFonts 和個別組件的 fontFamily 屬性處理
  // Text.defaultProps = { style: { fontFamily: "NotoSerifTC_400Regular" } };

  return (
    <GlassThemeProvider>
      <AuthProvider>
        <GlobalWebStyles />
        <RootLayoutNav />
      </AuthProvider>
    </GlassThemeProvider>
  );
}
