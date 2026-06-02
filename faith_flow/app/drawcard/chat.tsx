// app/drawcard/chat.tsx
// 活水泉源 - 對話視窗（5.2）

import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
    weekly_card_id: string;
    question: string;
    theme: string;
    quote: string;
    quote_source: string;
    image_url: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const scrollRef = useRef<ScrollView>(null);

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
          conversationId: conversationId || undefined,
        }),
      });

      if (!res.ok) throw new Error(`伺服器錯誤 (${res.status})`);

      const raw = await res.text();
      let reply = "";
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const obj = JSON.parse(line.slice(6).trim());
          if (obj.type === "done") {
            if (obj.reply) reply = obj.reply;
            if (obj.conversationId) setConversationId(String(obj.conversationId));
          }
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
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleEnd = () => {
    router.push({
      pathname: "/drawcard/summary",
      params: {
        weekly_card_id: params.weekly_card_id || "",
        question: params.question,
        theme: params.theme,
        quote: params.quote,
        quote_source: params.quote_source,
        image_url: params.image_url || "",
        conversation_id: conversationId,
        conversation: messages
          .map((m) => `${m.role === "user" ? "使用者" : "AI"}：${m.content}`)
          .join("\n"),
      },
    });
  };

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={90}
      >
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

        {/* 訊息列表 */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>輸入你的想法，{'\n'}讓活水泉源陪伴你反思。</Text>
            </View>
          )}

          {messages.map((msg) => (
            <View key={msg.id}>
              {msg.role === "user" && (
                <View style={styles.userMsgContainer}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{msg.content}</Text>
                  </View>
                </View>
              )}
              {msg.role === "assistant" && (
                <View style={styles.assistantContainer}>
                  <View style={styles.aiBubble}>
                    <Text style={styles.aiText}>{msg.content}</Text>
                  </View>
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.70)" />
              <Text style={styles.loadingText}>活水泉源思考中⋯</Text>
            </View>
          )}
        </ScrollView>

        {/* 輸入列 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="輸入你的回應..."
            placeholderTextColor="rgba(255,255,255,0.40)"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={(!input.trim() || loading) ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.75)"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 對話回顧 Modal */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🕐 對話回顧</Text>
              <TouchableOpacity onPress={() => setShowReview(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewHint}>
              對話記錄會自動儲存。每天凌晨1:00會自動結束對話。
            </Text>
            <ScrollView style={styles.modalBody}>
              {messages.length === 0 ? (
                <Text style={styles.modalEmpty}>目前沒有對話紀錄</Text>
              ) : (
                messages.map((msg) => (
                  <View key={msg.id} style={styles.historyItem}>
                    {msg.role === "user" ? (
                      <View style={styles.historyUserRow}>
                        <Text style={styles.historyRoleLabel}>你</Text>
                        <View style={styles.historyUserBubble}>
                          <Text style={styles.historyUserText}>{msg.content}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.historyAssistantRow}>
                        <Text style={styles.historyRoleLabel}>活水泉源</Text>
                        <View style={styles.historyAIBubble}>
                          <Text style={styles.historyText}>{msg.content}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
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

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: "rgba(255,255,255,0.65)", fontSize: 14, textAlign: "center", lineHeight: 22 },

  userMsgContainer: { alignItems: "flex-end", marginBottom: 12 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(102,126,234,0.75)", borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  userText: { color: "rgba(255,255,255,0.95)", fontSize: 15 },

  assistantContainer: { marginBottom: 16 },
  aiBubble: { backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "rgba(255,200,150,0.70)", padding: 12, marginBottom: 8 },
  aiText: { color: "rgba(255,255,255,0.90)", fontSize: 14, lineHeight: 22 },

  loadingContainer: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  loadingText: { color: "rgba(255,255,255,0.60)", fontSize: 13 },

  inputRow: { flexDirection: "row", padding: 12, backgroundColor: "rgba(0,0,0,0.42)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", gap: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: "rgba(255,255,255,0.95)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
  sendBtn: { backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 20, width: 42, height: 42, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { backgroundColor: "rgba(255,255,255,0.15)" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalContainer: { backgroundColor: "rgba(18,28,52,0.96)", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "rgba(255,255,255,0.90)" },
  modalClose: { fontSize: 20, color: "rgba(255,255,255,0.50)", padding: 4 },
  reviewHint: { fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", paddingVertical: 8, paddingHorizontal: 16 },
  modalBody: { padding: 16 },
  modalEmpty: { color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 20, fontSize: 14 },

  historyItem: { marginBottom: 12 },
  historyUserRow: { alignItems: "flex-end" },
  historyAssistantRow: { alignItems: "flex-start" },
  historyRoleLabel: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4 },
  historyUserBubble: { backgroundColor: "rgba(102,126,234,0.65)", borderRadius: 12, padding: 10, maxWidth: "85%" },
  historyUserText: { color: "rgba(255,255,255,0.95)", fontSize: 13 },
  historyAIBubble: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, borderLeftWidth: 3, borderLeftColor: "rgba(255,200,150,0.65)", padding: 10, maxWidth: "85%" },
  historyText: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 19 },
});
