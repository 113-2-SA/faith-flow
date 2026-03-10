import { useAuth } from "../hooks/useAuth";
import { Pressable, ScrollView, Text, View } from "react-native";

import { CalendarCard } from "../components/CalendarCard";
import { useAppShell } from "../components/AppShell";
import { VideoBackground } from "../components/VideoBackground";

export default function Home() {
  const { user } = useAuth();
  const { openDrawer } = useAppShell();

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>      
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, padding: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              marginBottom: 16,
            }}
          >
            <Pressable onPress={openDrawer} style={{ padding: 10 }}>
              <Text style={{ fontSize: 24, color: "white" }}>☰</Text>
            </Pressable>
          </View>

          <CalendarCard />

          <Text style={{ marginTop: 18, color: "rgba(255,255,255,0.72)" }}>
            你已登入：{user?.email ?? "(no email)"}
          </Text>
        </View>
      </ScrollView>
    </VideoBackground>
  );
}
