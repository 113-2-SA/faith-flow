import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "./context/authcontext";

export default function Index() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!currentUser) return <Redirect href="/auth/login" />;
  return <Redirect href="/home" />;
}
