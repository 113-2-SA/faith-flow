import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

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

  if (user && inAuth) {
    return <Redirect href="/settings" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

