// app/drawcard/index.tsx
// 活水泉源 - 抽卡主頁面

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const API_BASE = "http://140.136.155.150:3000";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W * 0.38;
const CARD_H = CARD_W * 1.55;

type WeeklyCard = {
  day: number;
  id: number;
  question: string;
  theme: string;
  depth: string;
  quote: string;
  quote_source: string;
};

export default function DrawCardScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<WeeklyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WeeklyCard | null>(null);

  useEffect(() => {
    fetchWeeklyCards();
  }, []);

  const fetchWeeklyCards = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/livingwater/weekly-cards`);
      const data = await res.json();
      if (data.success) {
        setCards(data.data);
      }
    } catch (err) {
      console.error("[DrawCard] fetchWeeklyCards failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // 今天是星期幾（1=一 ~ 5=五）
  const todayDay = (() => {
    const d = new Date().getDay();
    return d === 0 ? 5 : d; // 週日算第5天
  })();

  // 今天的卡片
  const todayCard = cards.find((c) => c.day === todayDay);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>

        {/* 頂部：本週剩餘次數 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            本週剩餘次數：1/5
          </Text>
          <View style={styles.slots}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[styles.slot, i === todayDay && styles.slotToday]}
              />
            ))}
          </View>
        </View>

        {/* 中間：卡片區 */}
        {!selectedCard ? (
          <View style={styles.cardArea}>
            <Text style={styles.hint}>今天還沒有抽卡！</Text>
            <View style={styles.cardRow}>
              {/* 顯示今天的卡和一張佔位卡 */}
              {todayCard && (
                <Pressable
                  style={styles.card}
                  onPress={() => setSelectedCard(todayCard)}
                />
              )}
              <View style={[styles.card, styles.cardDisabled]} />
            </View>
          </View>
        ) : (
          /* 翻面後：顯示問題 */
          <View style={styles.revealArea}>
            <View style={styles.revealCard}>
              <Text style={styles.themeText}>{selectedCard.theme}</Text>
              <Text style={styles.questionText}>{selectedCard.question}</Text>
              <Text style={styles.quoteText}>「{selectedCard.quote}」</Text>
              <Text style={styles.quoteSourceText}>——{selectedCard.quote_source}</Text>
            </View>
            <Pressable
              style={styles.startBtn}
              onPress={() =>
                router.push({
                  pathname: "/drawcard/chat",
                  params: {
                    questionId: selectedCard.id,
                    question: selectedCard.question,
                    theme: selectedCard.theme,
                    quote: selectedCard.quote,
                    quote_source: selectedCard.quote_source,
                  },
                })
              }
            >
              <Text style={styles.startBtnText}>開啟對話</Text>
            </Pressable>
          </View>
        )}

        {/* 底部：卡片&信箋按鈕 */}
        <Pressable
          style={styles.collectionBtn}
          onPress={() => router.push("/drawcard/collection")}
        >
          <Text style={styles.collectionIcon}>⊞</Text>
          <Text style={styles.collectionText}>卡片&信箋</Text>
        </Pressable>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#2d5a3d" },
  safe: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2d5a3d",
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  slots: { flexDirection: "row", gap: 6 },
  slot: {
    width: 28,
    height: 14,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  slotToday: { backgroundColor: "rgba(255,255,255,0.85)" },
  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  hint: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
  },
  cardRow: { flexDirection: "row", gap: 20 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardDisabled: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  revealArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 32,
  },
  revealCard: {
    width: CARD_W * 1.3,
    borderRadius: 16,
    backgroundColor: "rgba(20,20,40,0.82)",
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  themeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    letterSpacing: 1,
  },
  questionText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  quoteText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  quoteSourceText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    textAlign: "center",
  },
  startBtn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  collectionBtn: { alignItems: "center", paddingBottom: 32 },
  collectionIcon: { fontSize: 28, color: "rgba(255,255,255,0.85)" },
  collectionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 2,
  },
});