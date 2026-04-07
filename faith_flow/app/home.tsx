import { useAuth } from "../hooks/useAuth";
import { ScrollView, Text, View } from "react-native";

import { CalendarCard } from "../components/CalendarCard";
import { VideoBackground } from "../components/VideoBackground";
import { DateDisplay } from "../components/DateDisplay";
import { LiturgicalInfo } from "../components/LiturgicalInfo";

export default function Home() {
  const { user } = useAuth();
  const today = new Date();

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, padding: 24 }}>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <DateDisplay date={today} />
            <LiturgicalInfo date={today} />
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
