// app/drawcard/collection.tsx
// 活水泉源 - 卡片&信箋收藏頁（5.5）
// 顯示本週五張卡片，點擊可查看信箋詳細內容與對話記錄

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/authcontext";
import { toLocaleDateCST } from "../../utils/dateUtils";
import { API_BASE_URL } from "../../lib/api";
const { height: SCREEN_H } = Dimensions.get("window");

// 週次計算（例如：2025 week 51）
function getWeekLabel() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()} week ${weekNum}`;
}

type CardItem = {
  day: number;
  id: number;
  question: string;
  theme: string;
  quote: string;
  quote_source: string;
  image_base64?: string;
  // 信箋資料（對話結束後才有）
  summary?: string;
  conversation?: string;
  letter_date?: string;
};

export default function CollectionScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // 從 letter.tsx 帶過來的最新信箋資料
  const params = useLocalSearchParams<{
    question: string;
    theme: string;
    summary: string;
    quote: string;
    quote_source: string;
    image_base64: string;
    conversation: string; // 新增對話記錄參數，從 letter.tsx 帶過來（如果 collection.tsx 需要的話）
  }>();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // 底部抽屜動畫
  const drawerAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/livingwater/weekly-cards`);
      const data = await res.json();
      if (data.success) {
        // 如果從 letter.tsx 帶了最新信箋資料，補進今天的卡片
        const enriched = data.data.map((card: CardItem) => {
          const isToday = card.question === params.question;
if (isToday && params.summary) {
  return {
    ...card,
    image_base64: params.image_base64 || card.image_base64,
    summary: params.summary,
    quote: params.quote || card.quote,
    quote_source: params.quote_source || card.quote_source,
    letter_date: toLocaleDateCST(new Date()),
    conversation: params.conversation || "", // 補上對話記錄
  };
}
          return card;
        });
        setCards(enriched);
      }
    } catch (err) {
      console.error("[Collection] fetchCards failed:", err);
    }
  };

  // 開啟信箋詳細頁
  const openCard = (card: CardItem) => {
    setSelectedCard(card);
    setShowConversation(false);
    setShareSuccess(false);
  };

  // 關閉信箋詳細頁
  const closeCard = () => {
    setSelectedCard(null);
    setShowConversation(false);
  };

  // 分享到心靈營火
  const shareToFire = async () => {
    if (!selectedCard || sharing) return;
    try {
      setSharing(true);
      const token = await currentUser?.getIdToken();

      const postText = `📖 ${selectedCard.question}\n\n${selectedCard.summary || ""}\n\n「${selectedCard.quote}」\n——${selectedCard.quote_source}`;

      const res = await fetch(`${API_BASE_URL}/api/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          post_text: postText,
          post_type: "text", // letter_id 待 DB 建好後改為 'letter'
          visibility: "public",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShareSuccess(true);
      } else {
        alert("分享失敗，請稍後再試");
      }
    } catch (err) {
      console.error("[Collection] shareToFire failed:", err);
      alert("連線失敗");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>卡片&信箋</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 週次 */}
        <Text style={styles.weekLabel}>{getWeekLabel()}</Text>

        {/* 五張卡片縮圖 */}
        <FlatList
          data={cards}
          keyExtractor={(c) => c.day.toString()}
          horizontal
          contentContainerStyle={styles.cardList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.cardThumb} onPress={() => openCard(item)}>
              {item.image_base64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
                  style={styles.cardThumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cardThumbPlaceholder}>
                  <Text style={styles.cardThumbDay}>Day {item.day}</Text>
                </View>
              )}
              {/* 今日標記 */}
              {item.question === params.question && (
                <View style={styles.todayDot} />
              )}
            </Pressable>
          )}
        />

        {/* 信箋詳細頁 Modal */}
        <Modal visible={!!selectedCard} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>

              {/* 關閉按鈕 */}
              <Pressable style={styles.closeBtn} onPress={closeCard}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* 意境圖片 */}
                {selectedCard?.image_base64 ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${selectedCard.image_base64}` }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Text style={styles.modalImagePlaceholderText}>📷</Text>
                  </View>
                )}

                <View style={styles.modalContent}>
                  {/* 題目 */}
                  <Text style={styles.modalQuestion}>{selectedCard?.question}</Text>

                  {/* 摘要（有信箋才顯示） */}
                  {selectedCard?.summary ? (
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryText}>{selectedCard.summary}</Text>
                    </View>
                  ) : (
                    <View style={styles.noLetterBlock}>
                      <Text style={styles.noLetterText}>尚未完成對話，信箋未生成</Text>
                    </View>
                  )}

                  {/* 金句 */}
                  <View style={styles.quoteBlock}>
                    <Text style={styles.quoteText}>「{selectedCard?.quote}」</Text>
                    <Text style={styles.quoteSource}>—— {selectedCard?.quote_source}</Text>
                  </View>

                  {/* 分享按鈕 */}
                  {selectedCard?.summary && (
                    <Pressable
                      style={[styles.shareBtn, shareSuccess && styles.shareBtnSuccess]}
                      onPress={shareToFire}
                      disabled={sharing || shareSuccess}
                    >
                      <Text style={styles.shareBtnText}>
                        {shareSuccess ? "✅ 已分享到心靈營火" : sharing ? "分享中..." : "🔥 分享到心靈營火"}
                      </Text>
                    </Pressable>
                  )}

                  {/* 日期 */}
                  {selectedCard?.letter_date && (
                    <Text style={styles.letterDate}>
                      {selectedCard.letter_date} 的信箋
                    </Text>
                  )}

                  {/* 查看對話記錄提示 */}
                  {selectedCard?.summary && (
                    <Pressable
                      style={styles.conversationHint}
                      onPress={() => setShowConversation(true)}
                    >
                      <Text style={styles.conversationHintText}>↑ 向上查看對話記錄</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 對話記錄 Modal */}
        <Modal visible={showConversation} animationType="slide" transparent>
          <View style={styles.convOverlay}>
            <View style={styles.convPanel}>
              <View style={styles.convHeader}>
                <Text style={styles.convTitle}>對話回顧</Text>
                <Pressable onPress={() => setShowConversation(false)}>
                  <Text style={styles.convClose}>✕</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.convScroll}>
                <Text style={styles.convText}>
                  {selectedCard?.conversation || "（尚無對話記錄）"}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#2d5a3d" },
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backText: { color: "#fff", fontSize: 22 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  weekLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },

  // 卡片縮圖列表
  cardList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cardThumb: {
    width: 90,
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  cardThumbImage: { width: "100%", height: "100%" },
  cardThumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardThumbDay: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  todayDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFD700",
  },

  // 信箋詳細 Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: SCREEN_H * 0.85,
    backgroundColor: "#f5f0e8",
    borderRadius: 20,
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 14 },
  modalImage: { width: "100%", height: 200 },
  modalImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImagePlaceholderText: { fontSize: 40 },
  modalContent: { padding: 20, gap: 12 },
  modalQuestion: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 24,
  },
  summaryBlock: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    padding: 12,
  },
  summaryText: { color: "#444", fontSize: 14, lineHeight: 22 },
  noLetterBlock: {
    padding: 12,
    alignItems: "center",
  },
  noLetterText: { color: "#999", fontSize: 13 },
  quoteBlock: { borderLeftWidth: 3, borderLeftColor: "#8B4513", paddingLeft: 12 },
  quoteText: { color: "#555", fontSize: 14, fontStyle: "italic", lineHeight: 22 },
  quoteSource: { color: "#888", fontSize: 12, marginTop: 4, textAlign: "right" },

  // 分享按鈕
  shareBtn: {
    backgroundColor: "#2d5a3d",
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: "center",
  },
  shareBtnSuccess: { backgroundColor: "#4CAF50" },
  shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  letterDate: { color: "#999", fontSize: 12, textAlign: "center" },
  conversationHint: { alignItems: "center", paddingVertical: 8 },
  conversationHintText: { color: "#8B4513", fontSize: 13 },

  // 對話記錄 Modal
  convOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  convPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_H * 0.7,
    padding: 20,
  },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  convTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  convClose: { fontSize: 20, color: "#888" },
  convScroll: { flex: 1 },
  convText: { color: "#444", fontSize: 14, lineHeight: 22 },
});