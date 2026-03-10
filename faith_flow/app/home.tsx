import { useAuth } from "../hooks/useAuth";
import { ScrollView, Text, View } from "react-native";

import { CalendarCard } from "../components/CalendarCard";
import { VideoBackground } from "../components/VideoBackground";

export default function Home() {
  const { user } = useAuth();

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>      
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, padding: 24 }}>
          <CalendarCard />

          <Text style={{ marginTop: 18, color: "rgba(255,255,255,0.72)" }}>
            你已登入：{user?.email ?? "(no email)"}
          </Text>
        </View>
      </ScrollView>
    </VideoBackground>
  );
}
