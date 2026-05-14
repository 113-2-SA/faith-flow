import { useAuth } from "../hooks/useAuth";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { addMonths } from "../components/calendarUtils";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { CalendarCard } from "../components/CalendarCard";
import { VideoBackground } from "../components/VideoBackground";
import { DateDisplay } from "../components/DateDisplay";
import { LiturgicalInfo } from "../components/LiturgicalInfo";
import { GlassCard } from "../components/GlassCard";
import { PrayerNudgeModal } from "../components/PrayerNudgeModal";
import { DiaryHandle } from "../components/DiarySheet";
import { getPendingNudge, NudgeData } from "../lib/nudgeApi";

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDate, setSheetDate] = useState(todayStr);
  const [sheetCreateMode, setSheetCreateMode] = useState(false);

  const [viewDate, setViewDate] = useState(() => new Date());
  const [calExpanded, setCalExpanded] = useState(false);
  const [nudge, setNudge] = useState<NudgeData | null>(null);

  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalExpanded((v) => !v);
  };
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

  const handleStartConversation = () => {
    router.push('/pilgrimage'); // 導向對話頁面（依你實際的路由調整）
  };

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 88 }} showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, paddingHorizontal: 30, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <DateDisplay
                viewDate={viewDate}
                expanded={calExpanded}
                onToggle={toggleCalendar}
              />
              <LiturgicalInfo date={today} />
            </View>

            <CalendarCard
              viewDate={viewDate}
              expanded={calExpanded}
              onToggleExpanded={toggleCalendar}
              onPrev={() => setViewDate((d) => addMonths(d, -1))}
              onNext={() => setViewDate((d) => addMonths(d, +1))}
              onDatePress={(date) => {
                setSheetDate(date);
                setSheetCreateMode(false);
                setSheetOpen(true);
              }}
            />

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

            <Text style={{ marginTop: 12, color: "rgba(255,255,255,0.72)", fontFamily: "NotoSerifTC_400Regular" }}>
              你已登入：{user?.email ?? "(no email)"}
            </Text>
          </View>
        </ScrollView>

        {/* 底部日記底部面板（拖曳 & 日期點擊共用） */}
        <DiaryHandle
          open={sheetOpen}
          date={sheetDate}
          openInCreateMode={sheetCreateMode}
          onDragOpen={() => {
            setSheetDate(todayStr());
            setSheetCreateMode(true);
            setSheetOpen(true);
          }}
          onClose={() => setSheetOpen(false)}
        />
      </View>

      {/* 禱告回顧光點彈窗（有 nudge 時才顯示） */}
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
    fontFamily: 'NotoSerifTC_400Regular',
  },
  diaryListSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    fontFamily: 'NotoSerifTC_400Regular',
  },
  diaryListArrow: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '300',
  },
});
