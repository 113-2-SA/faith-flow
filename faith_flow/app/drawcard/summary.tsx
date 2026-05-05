// app/drawcard/summary.tsx
// 活水泉源 - 對話總結頁面（5.3）
// 流程：chat.tsx 按 ↪ → 此頁面自動生成摘要 → 按「結束」→ letter.tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/authcontext";

// ⚠️ 注意：本機測試用 localhost，手機/外部測試改回 140.136.155.150
const API_BASE = "http://localhost:3000";

export default function SummaryScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // 從 chat.tsx 帶過來的參數
  const params = useLocalSearchParams<{
    question: string;
    theme: string;
    quote: string;
    quote_source: string;
    conversation: string;
    image_base64: string; // 新增圖片參數，直接從 chat.tsx 帶過來（因為 letter.tsx 也需要）
    
  }>();

  // 摘要資料狀態
  const [summary, setSummary] = useState<string>("");
  const [quote, setQuote] = useState<string>(params.quote || "");
  const [quoteSource, setQuoteSource] = useState<string>(params.quote_source || "");
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // ── 進入頁面時自動呼叫 generate-letter API ──
  useEffect(() => {
    generateSummary();
  }, []);

  const generateSummary = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await currentUser?.getIdToken();

      const res = await fetch(`${API_BASE}/api/livingwater/generate-letter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: params.question,
          theme: params.theme,
          source_hint: params.quote_source,
          // conversation 從 chat.tsx 帶過來的完整對話記錄
          conversation: params.conversation,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // API 回傳：summary, quote, quote_source, image_prompt
        setSummary(data.data.summary || "");
        setQuote(data.data.quote || params.quote || "");
        setQuoteSource(data.data.quote_source || params.quote_source || "");
        setImagePrompt(data.data.image_prompt || "");
      } else {
        setError("摘要生成失敗，請稍後再試");
      }
    } catch (err) {
      console.error("[Summary] 生成摘要失敗：", err);
      setError("連線失敗，請確認網路狀態");
    } finally {
      setLoading(false);
    }
  };

  // ── 按「結束」→ 跳到 letter.tsx ──
  const handleFinish = () => {
  router.push({
    pathname: "/drawcard/letter",
    params: {
      question: params.question,
      theme: params.theme,
      summary,
      quote,
      quote_source: quoteSource,
      image_prompt: imagePrompt,
      image_base64: params.image_base64 || "", // 帶上圖片
      conversation: params.conversation || "", // 新增對話記錄參數，帶到 letter.tsx（如果 letter.tsx 需要的話）
    },
  });
};

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>對話總結</Text>
          {/* 結束按鈕：生成摘要完成後才能點 */}
          <Pressable
            style={[styles.endBtn, loading && styles.endBtnDisabled]}
            onPress={handleFinish}
            disabled={loading}
          >
            <Text style={styles.endBtnText}>結束</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 今日題目 */}
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>今日題目</Text>
            <Text style={styles.questionText}>{params.question}</Text>
          </View>

          {/* 摘要區塊 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ 對話摘要</Text>

            {/* 載入中 */}
            {loading && (
              <View style={styles.loadingArea}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>正在為你整理今天的旅程...</Text>
              </View>
            )}

            {/* 錯誤訊息 */}
            {!loading && error !== "" && (
              <View style={styles.errorArea}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={generateSummary} style={styles.retryBtn}>
                  <Text style={styles.retryText}>重新生成</Text>
                </Pressable>
              </View>
            )}

            {/* 摘要內容 */}
            {!loading && error === "" && (
              <Text style={styles.summaryText}>{summary}</Text>
            )}
          </View>

          {/* 金句區塊 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 今日金句</Text>
            <Text style={styles.quoteText}>「{quote}」</Text>
            <Text style={styles.quoteSource}>—— {quoteSource}</Text>
          </View>

        </ScrollView>
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
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  endBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endBtnDisabled: {
    opacity: 0.4,
  },
  endBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    gap: 16,
  },

  questionCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 16,
  },
  questionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 8,
  },
  questionText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 24,
  },

  section: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 12,
  },

  loadingArea: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },

  errorArea: {
    alignItems: "center",
    gap: 10,
  },
  errorText: {
    color: "#ffaaaa",
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
  },

  summaryText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 24,
  },

  quoteText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: 8,
  },
  quoteSource: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "right",
  },
});