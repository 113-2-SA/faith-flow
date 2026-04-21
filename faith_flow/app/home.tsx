import { useAuth } from "../hooks/useAuth";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { CalendarCard } from "../components/CalendarCard";
import { VideoBackground } from "../components/VideoBackground";
import { DateDisplay } from "../components/DateDisplay";
import { LiturgicalInfo } from "../components/LiturgicalInfo";
import { GlassCard } from "../components/GlassCard";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
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

          {/* 快捷入口 */}
          <TouchableOpacity
            style={styles.diaryListButton}
            onPress={() => router.push('/diary/list')}
          >
            <GlassCard style={styles.diaryListCard}>
              <View style={styles.diaryListRow}>
                <Text style={styles.diaryListIcon}>📖</Text>
                <View style={styles.diaryListText}>
                  <Text style={styles.diaryListTitle}>日記總覽</Text>
                  <Text style={styles.diaryListSub}>瀏覽與搜尋所有日記</Text>
                </View>
                <Text style={styles.diaryListArrow}>›</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>

          <Text style={{ marginTop: 12, color: "rgba(255,255,255,0.72)" }}>
            你已登入：{user?.email ?? "(no email)"}
          </Text>
        </View>
      </ScrollView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  diaryListButton: {
    marginTop: 16,
  },
  diaryListCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  diaryListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diaryListIcon: {
    fontSize: 28,
  },
  diaryListText: {
    flex: 1,
  },
  diaryListTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  diaryListSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  diaryListArrow: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '300',
  },
});
