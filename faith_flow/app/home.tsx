import { signOut } from "firebase/auth";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../lib/firebase";

export default function Home() {
  const { user } = useAuth();

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Home</Text>
      <Text>你已登入：{user?.email ?? "(no email)"}</Text>

      <Pressable
        onPress={() => signOut(auth)}
        style={{ padding: 14, borderRadius: 12, backgroundColor: "#b00020" }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>登出</Text>
      </Pressable>
    </View>
  );
}
