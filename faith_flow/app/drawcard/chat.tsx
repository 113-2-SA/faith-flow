// app/drawcard/chat.tsx
// 活水泉源 - 對話視窗（5.2）

import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/authcontext";

// ⚠️ 改用環境變數，手機版才能正常連線
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function DrawCardChatScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // 接收從 index.tsx 傳來的參數（新增 weekly_card_id）
  const params = useLocalSearchParams<{
    questionId: string;
    weekly_card_id: string; // 新增：用於記錄抽卡完成
    question: string;
    theme: string;
    quote: string;
    quote_source: string;
    image_base64: string;
  }>();

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

      const res = await fetch(`${API_BASE}/api/livingwater/chat`, {
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

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "（AI 暫時無法回應）",
      };
      setMessages((prev) => [...prev, aiMsg]);
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
  // ⭐ 新增：把 weekly_card_id 一起帶下去
  const handleEnd = () => {
    router.push({
      pathname: "/drawcard/summary",
      params: {
        weekly_card_id: params.weekly_card_id || "", // ⭐ 新增
        question: params.question,
        theme: params.theme,
        quote: params.quote,
        quote_source: params.quote_source,
        image_base64: params.image_base64 || "",
        conversation: messages
          .map((m) => `${m.role === "user" ? "使用者" : "AI"}：${m.content}`)
          .join("\n"),
      },
    });
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setShowReview(true)} style={styles.iconBtn}>
            <Text style={styles.iconText}>🕐</Text>
          </Pressable>
          <Pressable onPress={handleEnd} style={styles.iconBtn}>
            <Text style={styles.iconText}>↪</Text>
          </Pressable>
        </View>

        {/* 問題卡片 */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{params.question}</Text>
        </View>

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
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAI,
              ]}
            >
              <Text style={styles.bubbleText}>{item.content}</Text>
            </View>
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
            placeholderTextColor="rgba(255,255,255,0.5)"
            multiline
          />
          <Pressable
            style={styles.sendBtn}
            onPress={sendMessage}
            disabled={loading}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 對話回顧 Modal */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewPanel}>
            <Pressable
              onPress={() => setShowReview(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
            <Text style={styles.reviewTitle}>對話回顧</Text>
            <Text style={styles.reviewHint}>
              對話記錄會自動儲存。每天凌晨1:00會自動結束對話。
            </Text>
            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.reviewMsg,
                    item.role === "user" ? styles.reviewUser : styles.reviewAI,
                  ]}
                >
                  <Text style={styles.reviewMsgText}>{item.content}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#2d5a3d" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 50,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18, color: "#fff" },
  questionCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(20,20,40,0.7)",
  },
  questionText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  avatarArea: {
    alignItems: "center",
    paddingVertical: 8,
  },
  avatar: { fontSize: 40 },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageListContent: {
    paddingBottom: 8,
    gap: 8,
  },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  bubbleAI: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  bubbleText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { color: "#fff", fontSize: 18 },

  // Modal 樣式
  reviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  reviewPanel: {
    backgroundColor: "#1a3a2a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  closeText: { color: "#fff", fontSize: 18 },
  reviewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  reviewHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginBottom: 12,
  },
  reviewMsg: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  reviewUser: { backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "flex-end" },
  reviewAI: { backgroundColor: "rgba(0,0,0,0.3)", alignSelf: "flex-start" },
  reviewMsgText: { color: "#fff", fontSize: 13 },
  userBubble: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  userBubbleText: { color: "#fff", fontSize: 14 },
});