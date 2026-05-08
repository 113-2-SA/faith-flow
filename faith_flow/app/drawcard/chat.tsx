// app/drawcard/chat.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/authcontext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
type Message = { id: string; role: "user" | "assistant"; content: string; };

export default function DrawCardChatScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    questionId: string; weekly_card_id: string; question: string;
    theme: string; quote: string; quote_source: string; image_url: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const token = await currentUser?.getIdToken(true);
      const res = await fetch(`${API_BASE}/api/livingwater/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: params.question, theme: params.theme, message: userMsg.content, conversationId: currentConversationId }),
      });
      if (!res.ok) throw new Error(`伺服器錯誤 ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const chunk = line.slice(6).trim();
          if (!chunk || chunk === "[DONE]") continue;
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.type === "start" && parsed.conversationId) setCurrentConversationId(String(parsed.conversationId));
            else if (parsed.type === "chunk") setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: msg.content + parsed.text } : msg));
            else if (parsed.type === "done" && parsed.conversationId) setCurrentConversationId(String(parsed.conversationId));
            else if (parsed.type === "error") throw new Error(parsed.message);
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) {
      console.error("[DrawCardChat] send failed:", err);
      setMessages(prev => prev.map(msg => msg.id === assistantId ? { ...msg, content: "（連線失敗，請稍後再試）" } : msg));
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleEnd = () => {
    router.push({
      pathname: "/drawcard/summary",
      params: {
        weekly_card_id: params.weekly_card_id || "",
        question: params.question, theme: params.theme,
        quote: params.quote, quote_source: params.quote_source,
        image_url: params.image_url || "",
        conversation: messages.map(m => `${m.role === "user" ? "使用者" : "AI"}：${m.content}`).join("\n"),
      },
    });
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowReview(true)} style={styles.iconBtn}><Text style={styles.iconText}>🕐</Text></Pressable>
          <Pressable onPress={handleEnd} style={styles.iconBtn}><Text style={styles.iconText}>↪</Text></Pressable>
        </View>
        <View style={styles.questionCard}><Text style={styles.questionText}>{params.question}</Text></View>
        <View style={styles.avatarArea}><Text style={styles.avatar}>🐱</Text></View>
        <FlatList ref={flatListRef} data={messages} keyExtractor={m => m.id} style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
              <Text style={styles.bubbleText}>{item.content || (item.role === "assistant" && loading ? "思考中..." : "")}</Text>
            </View>
          )}
        />
        {loading && <View style={styles.loadingRow}><Text style={styles.loadingText}>活水泉源思考中...</Text></View>}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.inputArea}>
          <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="輸入你的回應..." placeholderTextColor="rgba(255,255,255,0.5)" multiline />
          <Pressable style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={sendMessage} disabled={loading}>
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewPanel}>
            <Pressable onPress={() => setShowReview(false)} style={styles.closeBtn}><Text style={styles.closeText}>✕</Text></Pressable>
            <Text style={styles.reviewTitle}>對話回顧</Text>
            <FlatList data={messages} keyExtractor={m => m.id}
              renderItem={({ item }) => (
                <View style={[styles.reviewMsg, item.role === "user" ? styles.reviewUser : styles.reviewAI]}>
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
  bg:{flex:1,backgroundColor:"#2d5a3d"}, safe:{flex:1},
  header:{flexDirection:"row",justifyContent:"flex-end",paddingTop:50,paddingHorizontal:16,gap:12},
  iconBtn:{width:40,height:40,borderRadius:20,backgroundColor:"rgba(255,255,255,0.2)",alignItems:"center",justifyContent:"center"},
  iconText:{fontSize:18,color:"#fff"},
  questionCard:{margin:16,padding:16,borderRadius:12,backgroundColor:"rgba(20,20,40,0.7)"},
  questionText:{color:"#fff",fontSize:14,lineHeight:22,textAlign:"center"},
  avatarArea:{alignItems:"center",paddingVertical:8}, avatar:{fontSize:40},
  messageList:{flex:1,paddingHorizontal:16}, messageListContent:{paddingBottom:8,gap:8},
  bubble:{maxWidth:"80%",padding:12,borderRadius:16},
  bubbleUser:{alignSelf:"flex-end",backgroundColor:"rgba(255,255,255,0.2)"},
  bubbleAI:{alignSelf:"flex-start",backgroundColor:"rgba(0,0,0,0.3)"},
  bubbleText:{color:"#fff",fontSize:14,lineHeight:20},
  loadingRow:{paddingHorizontal:16,paddingBottom:4},
  loadingText:{color:"rgba(255,255,255,0.5)",fontSize:12},
  inputArea:{flexDirection:"row",alignItems:"flex-end",paddingHorizontal:16,paddingBottom:32,gap:8},
  input:{flex:1,borderRadius:24,backgroundColor:"rgba(255,255,255,0.15)",color:"#fff",paddingHorizontal:16,paddingVertical:10,fontSize:14,maxHeight:100},
  sendBtn:{width:44,height:44,borderRadius:22,backgroundColor:"rgba(255,255,255,0.3)",alignItems:"center",justifyContent:"center"},
  sendBtnDisabled:{opacity:0.4}, sendIcon:{color:"#fff",fontSize:18},
  reviewOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  reviewPanel:{backgroundColor:"#1a3a2a",borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:"70%"},
  closeBtn:{alignSelf:"flex-end",padding:4}, closeText:{color:"#fff",fontSize:18},
  reviewTitle:{color:"#fff",fontSize:16,fontWeight:"bold",marginBottom:8},
  reviewMsg:{padding:10,borderRadius:10,marginBottom:8},
  reviewUser:{backgroundColor:"rgba(255,255,255,0.15)",alignSelf:"flex-end" as const},
  reviewAI:{backgroundColor:"rgba(0,0,0,0.3)",alignSelf:"flex-start" as const},
  reviewMsgText:{color:"#fff",fontSize:13},
});