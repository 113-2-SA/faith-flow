// app/drawcard/summary.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/authcontext";
import { API_BASE_URL } from "../../lib/api";

export default function SummaryScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    weekly_card_id: string; question: string; theme: string;
    quote: string; quote_source: string; conversation: string; image_url: string;
  }>();

  const [summary, setSummary] = useState("");
  const [quote, setQuote] = useState(params.quote || "");
  const [quoteSource, setQuoteSource] = useState(params.quote_source || "");
  const [imagePrompt, setImagePrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { generateSummary(); }, []);

  const generateSummary = async () => {
    try {
      setLoading(true); setError("");
      const token = await currentUser?.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/livingwater/generate-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: params.question, theme: params.theme, source_hint: params.quote_source, conversation: params.conversation }),
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data.summary || "");
        setImagePrompt(data.data.image_prompt || "");
      } else { setError("摘要生成失敗，請稍後再試"); }
    } catch (err) {
      console.error("[Summary] 生成摘要失敗：", err);
      setError("連線失敗，請確認網路狀態");
    } finally { setLoading(false); }
  };

  const handleFinish = () => {
    router.push({
      pathname: "/drawcard/letter",
      params: {
        weekly_card_id: params.weekly_card_id || "",
        question: params.question, theme: params.theme,
        summary, quote, quote_source: quoteSource,
        image_prompt: imagePrompt,
        image_url: params.image_url || "",
        conversation: params.conversation || "",
      },
    });
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>對話總結</Text>
          <Pressable style={[styles.endBtn, loading && styles.endBtnDisabled]} onPress={handleFinish} disabled={loading}>
            <Text style={styles.endBtnText}>結束</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>今日題目</Text>
            <Text style={styles.questionText}>{params.question}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ 對話摘要</Text>
            {loading && <View style={styles.loadingArea}><ActivityIndicator color="#fff" /><Text style={styles.loadingText}>正在為你整理今天的旅程...</Text></View>}
            {!loading && error !== "" && (
              <View style={styles.errorArea}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={generateSummary} style={styles.retryBtn}><Text style={styles.retryText}>重新生成</Text></Pressable>
              </View>
            )}
            {!loading && error === "" && <Text style={styles.summaryText}>{summary}</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 今日福音</Text>
            <Text style={styles.quoteText}>「{quote}」</Text>
            <Text style={styles.quoteSource}>—— {quoteSource}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg:{flex:1,backgroundColor:"#2d5a3d"}, safe:{flex:1},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingTop:50,paddingHorizontal:20,paddingBottom:16},
  headerTitle:{color:"#fff",fontSize:20,fontWeight:"bold"},
  endBtn:{backgroundColor:"rgba(255,255,255,0.25)",paddingHorizontal:20,paddingVertical:8,borderRadius:20},
  endBtnDisabled:{opacity:0.4}, endBtnText:{color:"#fff",fontSize:14,fontWeight:"600"},
  scroll:{flex:1}, scrollContent:{padding:20,gap:16},
  questionCard:{backgroundColor:"rgba(0,0,0,0.3)",borderRadius:16,padding:16},
  questionLabel:{color:"rgba(255,255,255,0.6)",fontSize:12,marginBottom:8},
  questionText:{color:"#fff",fontSize:15,lineHeight:24},
  section:{backgroundColor:"rgba(255,255,255,0.1)",borderRadius:16,padding:16},
  sectionTitle:{color:"#fff",fontSize:15,fontWeight:"bold",marginBottom:12},
  loadingArea:{alignItems:"center",gap:10,paddingVertical:16},
  loadingText:{color:"rgba(255,255,255,0.7)",fontSize:13},
  errorArea:{alignItems:"center",gap:10},
  errorText:{color:"#ffaaaa",fontSize:13},
  retryBtn:{backgroundColor:"rgba(255,255,255,0.2)",paddingHorizontal:16,paddingVertical:8,borderRadius:12},
  retryText:{color:"#fff",fontSize:13},
  summaryText:{color:"#fff",fontSize:14,lineHeight:24},
  quoteText:{color:"#fff",fontSize:15,lineHeight:24,fontStyle:"italic",marginBottom:8},
  quoteSource:{color:"rgba(255,255,255,0.6)",fontSize:12,textAlign:"right"},
});