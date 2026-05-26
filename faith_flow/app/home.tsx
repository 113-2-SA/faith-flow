import { useAuth } from "../hooks/useAuth";
import { Animated, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { addMonths } from "../components/calendarUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../lib/api";
import { auth } from "../lib/firebase";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── 首次進入導覽 ─────────────────────────────────────────────
const HOME_TOUR_KEY = 'faith_flow_home_tour_v1';

const TOUR_STEPS = [
  { title: "🙏 歡迎使用 Faith Flow", body: "你的天主教靈修旅伴，陪你記錄信仰、探索真理、與教友同行。" },
  { title: "📖 祈禱日記", body: "每天記錄靈修心得，AI 自動分析情緒與主題，協助你看見信仰成長的軌跡。" },
  { title: "💬 有答大師", body: "向 AI 提出任何信仰問題，結合天主教教義知識與個人化陪伴回應，感性理性兼顧。" },
  { title: "💌 活水泉源", body: "抽取靈修主題卡，與 AI 深度對話，結束後收到專屬信箋與意境插圖。" },
  { title: "🕊️ 教友社群", body: "與同行的教友分享日記、靈感與反思，彼此扶持在信仰路上同行。" },
  { title: "✍️ 讓 AI 更了解你", body: null },
];
const BIO_STEP_INDEX = TOUR_STEPS.length - 1;

function HomeTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [step, opacity]);

  const fadeAndGo = useCallback((next: () => void) => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => next());
  }, [opacity]);

  const handleFinish = useCallback(async () => {
    if (bio.trim()) {
      setSaving(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          await fetch(`${API_BASE_URL}/api/user/profile`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ profile: bio.trim() }),
          });
        }
      } catch {
        // 儲存失敗不影響流程，使用者可在設定頁補填
      } finally {
        setSaving(false);
      }
    }
    onDone();
  }, [bio, onDone]);

  const goNext = useCallback(() => {
    if (step + 1 >= TOUR_STEPS.length) {
      handleFinish();
    } else {
      fadeAndGo(() => setStep((s) => s + 1));
    }
  }, [step, fadeAndGo, handleFinish]);

  const current = TOUR_STEPS[step];
  const isBioStep = step === BIO_STEP_INDEX;
  const isLast = step + 1 >= TOUR_STEPS.length;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        style={homeTourStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={homeTourStyles.backdrop} onPress={isBioStep ? undefined : goNext} />
        <Animated.View style={[homeTourStyles.card, { opacity }]}>
          <Text style={homeTourStyles.stepLabel}>{step + 1} / {TOUR_STEPS.length}</Text>
          <Text style={homeTourStyles.title}>{current.title}</Text>

          {isBioStep ? (
            <>
              <Text style={homeTourStyles.body}>
                介紹你自己，信仰程度、職業、興趣等，讓 AI 更認識你
              </Text>
              <TextInput
                style={homeTourStyles.bioInput}
                placeholder="例如：教友 5 年，每週主日彌撒，對靈修閱讀有興趣..."
                placeholderTextColor="rgba(0,0,0,0.35)"
                multiline
                maxLength={200}
                value={bio}
                onChangeText={setBio}
                textAlignVertical="top"
              />
            </>
          ) : (
            <Text style={homeTourStyles.body}>{current.body}</Text>
          )}

          <View style={homeTourStyles.actions}>
            <Pressable onPress={goNext} style={[homeTourStyles.next, { marginLeft: 'auto' }]} disabled={saving}>
              <Text style={homeTourStyles.nextText}>
                {saving ? "儲存中..." : isLast ? "完成" : "下一步"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  const [showHomeTour, setShowHomeTour] = useState(false);

  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalExpanded((v) => !v);
  };
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 首次進入首頁時顯示導覽
  useEffect(() => {
    AsyncStorage.getItem(HOME_TOUR_KEY).then((done) => {
      if (!done) setTimeout(() => setShowHomeTour(true), 800);
    });
  }, []);

  const endHomeTour = useCallback(() => {
    setShowHomeTour(false);
    AsyncStorage.setItem(HOME_TOUR_KEY, 'true');
  }, []);

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
    router.push('/chat'); // 導向對話頁面（依你實際的路由調整）
  };

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")} overlay={false}>
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

      {/* 首次進入導覽（含個人簡介填寫） */}
      {showHomeTour && <HomeTour onDone={endHomeTour} />}
    </VideoBackground>
  );
}

const homeTourStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.85)',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.65)',
    lineHeight: 22,
    marginBottom: 24,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: 'rgba(0,0,0,0.8)',
    minHeight: 90,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.35)',
  },
  next: {
    backgroundColor: 'rgba(102,126,234,0.90)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

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
