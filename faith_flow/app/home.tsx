import { useAuth } from "../hooks/useAuth";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CopilotStep, walkthroughable, useCopilot } from "react-native-copilot";

import { CalendarCard } from "../components/CalendarCard";
import { VideoBackground } from "../components/VideoBackground";
import { DateDisplay } from "../components/DateDisplay";
import { LiturgicalInfo } from "../components/LiturgicalInfo";
import { GlassCard } from "../components/GlassCard";
import { PrayerNudgeModal } from "../components/PrayerNudgeModal";
import { getPendingNudge, NudgeData } from "./api/nudgeApi";

const WalkthroughableView = walkthroughable(View);

const TOUR_KEY = "faith_flow_home_tour_v1";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date();
  const { start } = useCopilot();

  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 停留 4 秒後查詢是否有待顯示的光點回顧
  useEffect(() => {
    nudgeTimer.current = setTimeout(async () => {
      try {
        const pending = await getPendingNudge();
        if (pending) setNudge(pending);
      } catch {
        // 查詢失敗不影響畫面
      }
    }, 4000);

    return () => { clearTimeout(nudgeTimer.current ?? undefined); };
  }, []);

  // 首次進入自動啟動導覽
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TOUR_KEY).then((done) => {
      if (!done && !cancelled) {
        setTimeout(() => {
          if (!cancelled) {
            start();
            AsyncStorage.setItem(TOUR_KEY, "true");
          }
        }, 1500);
      }
    });
    return () => { cancelled = true; };
  }, [start]);

  const handleStartConversation = () => {
    router.push('/pilgrimage');
  };

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, padding: 24 }}>

          {/* 頂部列：日期 + 禮儀資訊 */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <DateDisplay date={today} />

            {/* 步驟 2：禮儀資訊 */}
            <CopilotStep
              text="禮儀資訊：顯示今日天主教禮儀時期與慶節，讓你在祈禱前了解當下的靈修意涵。"
              order={2}
              name="liturgical"
            >
              <WalkthroughableView style={{ flex: 1 }}>
                <LiturgicalInfo date={today} />
              </WalkthroughableView>
            </CopilotStep>
          </View>

          {/* 步驟 3：日曆 */}
          <CopilotStep
            text="日曆：點選任一日期，即可進入當天的祈禱日記列表，記錄或回顧信仰旅程。"
            order={3}
            name="calendar"
          >
            <WalkthroughableView collapsable={false} style={{ alignSelf: 'stretch' }}>
              <CalendarCard />
            </WalkthroughableView>
          </CopilotStep>

          {/* 步驟 4：今日標示圖例 */}
          <CopilotStep
            text="今日標示：日期下方的藍色小點代表當天已有日記；白色框線格子為今天。"
            order={4}
            name="today_marker"
          >
            <WalkthroughableView style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.legendTodayCell}>
                  <Text style={styles.legendTodayCellText}>今</Text>
                </View>
                <Text style={styles.legendLabel}>今天</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendDotCell}>
                  <View style={styles.legendDot} />
                </View>
                <Text style={styles.legendLabel}>有日記</Text>
              </View>
            </WalkthroughableView>
          </CopilotStep>

          {/* 步驟 5：週統整入口 */}
          <CopilotStep
            text="週統整：AI 自動整合一週的祈禱內容，幫助你回顧信仰成長。點此進入日記列表後，可在右上角查看。"
            order={5}
            name="weekly_summary"
          >
            <WalkthroughableView>
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
            </WalkthroughableView>
          </CopilotStep>

          <View style={styles.bottomRow}>
            <Text style={styles.emailText}>
              你已登入：{user?.email ?? "(no email)"}
            </Text>
            {/* 重新啟動導覽按鈕 */}
            <Pressable onPress={() => start()} style={styles.helpButton}>
              <Text style={styles.helpButtonText}>?</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {nudge && (
        <PrayerNudgeModal
          nudge={nudge}
          onClose={() => setNudge(null)}
          onStartConversation={handleStartConversation}
        />
      )}
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendTodayCell: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  legendTodayCellText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "700",
  },
  legendDotCell: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(135, 206, 250, 0.9)",
  },
  legendLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  diaryListButton: {
    marginTop: 14,
  },
  diaryListCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  diaryListRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  diaryListSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  diaryListArrow: {
    fontSize: 26,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "300",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  emailText: {
    color: "rgba(255,255,255,0.72)",
    flex: 1,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpButtonText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "700",
  },
});
