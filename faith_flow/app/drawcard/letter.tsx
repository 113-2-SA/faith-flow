// app/drawcard/letter.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/authcontext";
import { API_BASE_URL } from "../../lib/api";

export default function LetterScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    weekly_card_id: string; question: string; theme: string; summary: string;
    quote: string; quote_source: string; image_prompt: string; image_url: string; conversation: string;
  }>();

  const [letterId, setLetterId] = useState<number | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    completeDraw();
  }, []);

  const completeDraw = async () => {
    if (!params.weekly_card_id || !currentUser) return;
    try {
      const token = await currentUser.getIdToken(true);
      const drawsRes = await fetch(`${API_BASE_URL}/api/livingwater/my-draws`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const drawsData = await drawsRes.json();
      if (!drawsData.success) return;
      const myDraw = drawsData.data.find((d: any) => String(d.weekly_card_id) === String(params.weekly_card_id));
      if (!myDraw) return;

      const completeRes = await fetch(`${API_BASE_URL}/api/livingwater/complete-draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_draws_id: myDraw.user_draws_id,
          summary: params.summary || null,
          letter_quote: params.quote || null,
          letter_quote_source: params.quote_source || null,
        }),
      });
      const completeData = await completeRes.json();
      if (completeData.success && completeData.data?.letter_id) {
        setLetterId(completeData.data.letter_id);
      }
    } catch (err) { console.warn("[Letter] complete-draw 失敗:", err); }
  };

  const handleCollect = () => {
    router.push({
      pathname: "/drawcard/collection",
      params: {
        question: params.question, theme: params.theme, summary: params.summary,
        quote: params.quote, quote_source: params.quote_source,
        image_url: params.image_url || '',
        conversation: params.conversation || "",
        letter_id: letterId ? String(letterId) : '',
      },
    });
  };

  const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "numeric", day: "numeric" });

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.letterCard}>
            <View style={styles.imageCol}>
              {params.image_url ? (
                <Image source={{ uri: params.image_url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>🖼️</Text></View>
              )}
            </View>
            <View style={styles.textCol}>
              <Text style={styles.questionText}>{params.question}</Text>
              {params.summary ? <Text style={styles.summaryText}>{params.summary}</Text> : null}
              <View style={styles.quoteBlock}>
                <Text style={styles.quoteText}>「{params.quote}」</Text>
                <Text style={styles.quoteSource}>——{params.quote_source}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.dateText}>{today} 的信箋</Text>
        </ScrollView>
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
  bg:{flex:1,backgroundColor:"#f0ede6"}, safe:{flex:1},
  scroll:{flex:1}, scrollContent:{padding:20,alignItems:"center",gap:12},
  letterCard:{width:"100%",flexDirection:"row",backgroundColor:"#fff",borderRadius:16,overflow:"hidden",shadowColor:"#000",shadowOffset:{width:0,height:4},shadowOpacity:0.12,shadowRadius:12,elevation:6,minHeight:320},
  imageCol:{width:"38%"},
  image:{width:"100%",height:"100%"},
  imagePlaceholder:{flex:1,backgroundColor:"#ddd",alignItems:"center",justifyContent:"center"},
  imagePlaceholderText:{fontSize:32},
  textCol:{flex:1,padding:16,gap:10,justifyContent:"center"},
  questionText:{fontSize:13,fontWeight:"600",color:"#333",lineHeight:20},
  summaryText:{fontSize:12,color:"#555",lineHeight:19},
  quoteBlock:{borderLeftWidth:3,borderLeftColor:"#8B6914",paddingLeft:8,marginTop:4},
  quoteText:{fontSize:12,color:"#444",fontStyle:"italic",lineHeight:18},
  quoteSource:{fontSize:11,color:"#888",textAlign:"right",marginTop:4},
  dateText:{color:"#999",fontSize:12,textAlign:"center"},
  footer:{padding:20,paddingBottom:32},
  collectBtn:{backgroundColor:"#2d5a3d",borderRadius:30,paddingVertical:16,alignItems:"center"},
  collectBtnText:{color:"#fff",fontSize:16,fontWeight:"bold"},
});