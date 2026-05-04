// app/drawcard/letter.tsx
// 活水泉源 - 信箋完成頁面（5.4）

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/authcontext";

// ⚠️ 改用環境變數，手機版才能正常連線
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export default function LetterScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // 接收從 summary.tsx 帶過來的參數（新增 weekly_card_id）
  const params = useLocalSearchParams<{
    weekly_card_id: string; // ⭐ 新增：用來標記完成
    question: string;
    theme: string;
    summary: string;
    quote: string;
    quote_source: string;
    image_prompt: string;
    image_base64: string;
    conversation: string;
  }>();

  // 用 ref 避免重複呼叫
  const hasCompletedRef = useRef(false);

  // ⭐ 進入頁面時自動標記「已完成」
  useEffect(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    completeDraw();
  }, []);

  const completeDraw = async () => {
    if (!params.weekly_card_id || !currentUser) return;

    try {
      const token = await currentUser.getIdToken(true);

      // 先取得 user_draws_id
      const drawsRes = await fetch(`${API_BASE}/api/livingwater/my-draws`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const drawsData = await drawsRes.json();

      if (!drawsData.success) return;

      // 找到對應這張卡的 user_draws 記錄
      const myDraw = drawsData.data.find(
        (d: any) => String(d.weekly_card_id) === String(params.weekly_card_id)
      );

      if (!myDraw) return;

      // 呼叫 complete-draw API 標記完成
      await fetch(`${API_BASE}/api/livingwater/complete-draw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_draws_id: myDraw.user_draws_id,
          summary: params.summary || null,
          letter_quote: params.quote || null,
          letter_quote_source: params.quote_source || null,
        }),
      });

      console.log("[Letter] ✅ 抽卡完成已標記");
    } catch (err) {
      // 失敗不影響使用者體驗，只記錄 log
      console.warn("[Letter] complete-draw 失敗:", err);
    }
  };

  // 把 base64 字串組成可以直接給 Image 用的 dataUrl
  const imageDataUrl = params.image_base64
    ? `data:image/jpeg;base64,${params.image_base64}`
    : "";

  // 按「收下卡片及信箋」→ 跳到 collection.tsx
  const handleCollect = () => {
    router.push({
      pathname: "/drawcard/collection",
      params: {
        question: params.question,
        theme: params.theme,
        summary: params.summary,
        quote: params.quote,
        quote_source: params.quote_source,
        image_base64: params.image_base64 || "",
        conversation: params.conversation || "",
      },
    });
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✉️ 你的信箋</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          {/* 意境圖片區塊 */}
          <View style={styles.imageCard}>
            {imageDataUrl !== "" ? (
              <Image
                source={{ uri: imageDataUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imageErrorText}>圖片暫時無法顯示</Text>
              </View>
            )}
          </View>

          {/* 金句區塊 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 今日金句</Text>
            <Text style={styles.quoteText}>「{params.quote}」</Text>
            <Text style={styles.quoteSource}>—— {params.quote_source}</Text>
          </View>

          {/* 摘要區塊 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ 對話摘要</Text>
            <Text style={styles.summaryText}>{params.summary}</Text>
          </View>

        </ScrollView>

        {/* 底部按鈕 */}
        <View style={styles.footer}>
          <Pressable style={styles.collectBtn} onPress={handleCollect}>
            <Text style={styles.collectBtnText}>收下卡片及信箋</Text>
          </Pressable>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#2d5a3d" },
  safe: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  imageCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.3)",
    minHeight: 280,
  },
  imagePlaceholder: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  imageErrorText: { color: "#ffaaaa", fontSize: 13 },
  image: { width: "100%", height: 280 },
  section: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "bold", marginBottom: 12 },
  quoteText: {
    color: "#fff", fontSize: 15, lineHeight: 24,
    fontStyle: "italic", marginBottom: 8,
  },
  quoteSource: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "right" },
  summaryText: { color: "#fff", fontSize: 14, lineHeight: 24 },
  footer: { padding: 20, paddingBottom: 32 },
  collectBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  collectBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});