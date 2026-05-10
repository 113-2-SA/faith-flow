// app/drawcard/chat.tsx
// 活水泉源 - 對話視窗（5.2）

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/authcontext";
import { VideoBackground } from "../../components/VideoBackground";
import { GlassCard } from "../../components/GlassCard";
import { API_BASE_URL } from "../../lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function DrawCardChatScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    questionId: string;
    question: string;
    theme: string;
    quote: string;
    quote_source: string;
    image_base64: string; // 新增圖片參數
  }>();

  // 對話串從空的開始，問題卡片已經顯示在上方了
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = await currentUser?.getIdToken();
      const conversationText = messages
        .map((m) => `${m.role === "user" ? "使用者" : "AI"}：${m.content}`)
        .join("\n");

      const res = await fetch(`${API_BASE_URL}/api/livingwater/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: params.question,
          theme: params.theme,
          message: userMsg.content,
          conversation: conversationText,
        }),
      });

      // 後端回傳 SSE 串流，逐行解析取出 done 事件的 reply
      const raw = await res.text();
      let reply = "";
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const obj = JSON.parse(line.slice(6).trim());
          if (obj.type === "done" && obj.reply) reply = obj.reply;
          if (obj.type === "error" && !reply) reply = obj.message || "";
        } catch { /* skip malformed chunk */ }
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: reply || "（AI 暫時無法回應）" },
      ]);
    } catch (err) {
      console.error("[DrawCardChat] send failed:", err);
      setMessages((prev) => [
        ...prev,
        { id: "err", role: "assistant", content: "（連線失敗，請稍後再試）" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 結束對話 → 跳到對話總結（5.3）
  const handleEnd = () => {
  router.push({
    pathname: "/drawcard/summary",
    params: {
      question: params.question,
      theme: params.theme,
      quote: params.quote,
      quote_source: params.quote_source,
      image_base64: params.image_base64 || "", // 繼續帶下去
      conversation: messages
        .map((m) => `${m.role === "user" ? "使用者" : "AI"}：${m.content}`)
        .join("\n"),
    },
  });
};

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setShowReview(true)} style={styles.iconBtn}>
            <MaterialCommunityIcons name="history" size={20} color="rgba(255,255,255,0.90)" />
          </Pressable>
          <Pressable onPress={handleEnd} style={styles.iconBtn}>
            <MaterialCommunityIcons name="check-all" size={20} color="rgba(255,255,255,0.90)" />
          </Pressable>
        </View>

        {/* 問題卡片 */}
        <GlassCard style={styles.questionCard}>
          <Text style={styles.questionText}>{params.question}</Text>
        </GlassCard>

        {/* AI 角色圖 */}
        <View style={styles.avatarArea}>
          <Text style={styles.avatar}>🐱</Text>
        </View>

        {/* 完整對話串 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <GlassCard
              style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAI]}
              glassColor={item.role === "user" ? "rgba(102,126,234,0.60)" : "rgba(255,255,255,0.10)"}
            >
              <Text style={styles.bubbleText}>{item.content}</Text>
            </GlassCard>
          )}
        />

        {/* 載入中提示 */}
        {loading && (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>活水泉源思考中...</Text>
          </View>
        )}

        {/* 輸入框 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.inputArea}
        >
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="輸入你的回應..."
            placeholderTextColor="rgba(255,255,255,0.40)"
            multiline
          />
          <Pressable style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={sendMessage} disabled={loading}>
            <MaterialCommunityIcons name="send" size={20} color={loading ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.75)"} />
          </Pressable>
        </KeyboardAvoidingView>
      </View>

      {/* 對話回顧 Modal */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewPanel}>
            <Pressable onPress={() => setShowReview(false)} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.70)" />
            </Pressable>
            <Text style={styles.reviewTitle}>對話回顧</Text>
            <Text style={styles.reviewHint}>
              對話記錄會自動儲存。每天凌晨1:00會自動結束對話。
            </Text>
            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <View style={[styles.reviewMsg, item.role === "user" ? styles.reviewUser : styles.reviewAI]}>
                  <Text style={styles.reviewMsgText}>{item.content}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  questionCard: { margin: 16, marginBottom: 0 },
  questionText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  avatarArea: { alignItems: "center", paddingVertical: 8 },
  avatar: { fontSize: 40 },
  messageList: { flex: 1, paddingHorizontal: 12 },
  messageListContent: { paddingBottom: 8, gap: 8 },
  bubble: { maxWidth: "80%", padding: 0 },
  bubbleUser: { alignSelf: "flex-end" },
  bubbleAI: { alignSelf: "flex-start" },
  bubbleText: { color: "rgba(255,255,255,0.95)", fontSize: 14, lineHeight: 20 },
  loadingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  loadingText: { color: "rgba(255,255,255,0.50)", fontSize: 12 },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.40)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    color: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(255,255,255,0.15)" },
  reviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  reviewPanel: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "rgba(18,28,52,0.96)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginBottom: 8,
  },
  reviewHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
    marginBottom: 16,
  },
  reviewMsg: { padding: 10, borderRadius: 10, marginBottom: 8 },
  reviewUser: { backgroundColor: "rgba(102,126,234,0.30)", alignSelf: "flex-end" },
  reviewAI: { backgroundColor: "rgba(255,255,255,0.10)", alignSelf: "flex-start" },
  reviewMsgText: { fontSize: 14, color: "rgba(255,255,255,0.90)", lineHeight: 20 },
});