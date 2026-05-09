// app/drawcard/collection.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/authcontext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const { height: SCREEN_H } = Dimensions.get("window");

function getWeekLabel() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return now.getFullYear() + " week " + weekNum;
}

type CardItem = {
  day: number; id: number; question: string; theme: string;
  quote: string; quote_source: string; image_url?: string;
  summary?: string; conversation?: string; letter_date?: string; letter_id?: number;
  weekly_card_id?: number;
};

export default function CollectionScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    question: string; theme: string; summary: string; quote: string;
    quote_source: string; image_url: string; conversation: string; letter_id: string;
  }>();

  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const drawerAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try {
      let myDraws: any[] = [];
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const drawsRes = await fetch(API_BASE + "/api/livingwater/my-draws", {
            headers: { Authorization: 'Bearer ' + token }
          });
          const drawsData = await drawsRes.json();
          if (drawsData.success) myDraws = drawsData.data;
        } catch (e) { console.warn('[Collection] 取得 my-draws 失敗:', e); }
      }

      const res = await fetch(API_BASE + "/api/livingwater/weekly-cards");
      const data = await res.json();
      if (data.success) {
        const enriched = data.data.map((card: CardItem) => {
          const isToday = card.question === params.question;
          const myDraw = myDraws.find((d: any) => String(d.weekly_card_id) === String(card.weekly_card_id));
          const dbSummary = myDraw?.summary || null;
          const dbQuote = myDraw?.letter_quote || null;
          const dbQuoteSource = myDraw?.letter_quote_source || null;
          const dbLetterId = myDraw?.letter_id || null;

          if (isToday && params.summary) {
            return { ...card, image_url: params.image_url || card.image_url, summary: params.summary,
              quote: params.quote || card.quote, quote_source: params.quote_source || card.quote_source,
              letter_date: new Date().toLocaleDateString("zh-TW"), conversation: params.conversation || "",
              letter_id: params.letter_id ? Number(params.letter_id) : dbLetterId };
          } else if (dbSummary) {
            return { ...card, summary: dbSummary, quote: dbQuote || card.quote, quote_source: dbQuoteSource || card.quote_source,
              letter_date: myDraw?.drawdate ? new Date(myDraw.drawdate).toLocaleDateString("zh-TW") : undefined,
              letter_id: dbLetterId };
          }
          return card;
        });
        setCards(enriched);
      }
    } catch (err) { console.error("[Collection] fetchCards failed:", err); }
  };

  const openCard = (card: CardItem) => { setSelectedCard(card); setShowConversation(false); };
  const closeCard = () => { setSelectedCard(null); setShowConversation(false); };

  const shareToFire = () => {
    if (!selectedCard) return;
    if (selectedCard.letter_id) {
      router.push((`/community/create?letter_id=${selectedCard.letter_id}`) as never);
    } else {
      router.push('/community/create' as never);
    }
    closeCard();
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backText}>←</Text></Pressable>
          <Text style={styles.headerTitle}>卡片&信箋</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.weekLabel}>{getWeekLabel()}</Text>
        <FlatList data={cards} keyExtractor={c => c.day.toString()} horizontal
          contentContainerStyle={styles.cardList} showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.cardThumb} onPress={() => openCard(item)}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardThumbImage} resizeMode="cover" />
              ) : (
                <View style={styles.cardThumbPlaceholder}><Text style={styles.cardThumbDay}>Day {item.day}</Text></View>
              )}
              {item.question === params.question && <View style={styles.todayDot} />}
            </Pressable>
          )}
        />
        <Modal visible={!!selectedCard} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Pressable style={styles.closeBtn} onPress={closeCard}><Text style={styles.closeBtnText}>✕</Text></Pressable>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.letterRow}>
                  <View style={styles.imageCol}>
                    {selectedCard?.image_url ? (
                      <Image source={{ uri: selectedCard.image_url }} style={styles.letterImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>📷</Text></View>
                    )}
                  </View>
                  <View style={styles.textCol}>
                    <Text style={styles.modalQuestion}>{selectedCard?.question}</Text>
                    {selectedCard?.summary ? (
                      <Text style={styles.summaryText}>{selectedCard.summary}</Text>
                    ) : (
                      <Text style={styles.noLetterText}>尚未完成對話，信箋未生成</Text>
                    )}
                    <View style={styles.quoteBlock}>
                      <Text style={styles.quoteText}>「{selectedCard?.quote}」</Text>
                      <Text style={styles.quoteSource}>—— {selectedCard?.quote_source}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modalFooter}>
                  {selectedCard?.summary && (
                    <Pressable style={styles.shareBtn} onPress={shareToFire}>
                      <Text style={styles.shareBtnText}>🔥 分享到心靈營火</Text>
                    </Pressable>
                  )}
                  {selectedCard?.letter_date && <Text style={styles.letterDate}>{selectedCard.letter_date} 的信箋</Text>}
                  {selectedCard?.summary && (
                    <Pressable style={styles.conversationHint} onPress={() => setShowConversation(true)}>
                      <Text style={styles.conversationHintText}>↑ 向上查看對話記錄</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal visible={showConversation} animationType="slide" transparent>
          <View style={styles.convOverlay}>
            <View style={styles.convPanel}>
              <View style={styles.convHeader}>
                <Text style={styles.convTitle}>對話回顧</Text>
                <Pressable onPress={() => setShowConversation(false)}><Text style={styles.convClose}>✕</Text></Pressable>
              </View>
              <ScrollView style={styles.convScroll}>
                <Text style={styles.convText}>{selectedCard?.conversation || "（尚無對話記錄）"}</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg:{flex:1,backgroundColor:"#2d5a3d"}, safe:{flex:1},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingTop:50,paddingHorizontal:20,paddingBottom:12},
  backBtn:{width:40,height:40,justifyContent:"center"}, backText:{color:"#fff",fontSize:22},
  headerTitle:{color:"#fff",fontSize:18,fontWeight:"bold"},
  weekLabel:{color:"rgba(255,255,255,0.7)",fontSize:13,textAlign:"center",marginBottom:16},
  cardList:{paddingHorizontal:20,gap:12},
  cardThumb:{width:90,height:130,borderRadius:12,overflow:"hidden",backgroundColor:"rgba(255,255,255,0.2)"},
  cardThumbImage:{width:"100%",height:"100%"},
  cardThumbPlaceholder:{flex:1,alignItems:"center",justifyContent:"center"},
  cardThumbDay:{color:"rgba(255,255,255,0.6)",fontSize:12},
  todayDot:{position:"absolute",bottom:6,right:6,width:8,height:8,borderRadius:4,backgroundColor:"#FFD700"},
  modalOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"center",alignItems:"center",padding:20},
  modalCard:{width:"100%",maxHeight:SCREEN_H*0.85,backgroundColor:"#f5f0e8",borderRadius:20,overflow:"hidden"},
  closeBtn:{position:"absolute",top:12,right:12,zIndex:10,backgroundColor:"rgba(0,0,0,0.3)",width:32,height:32,borderRadius:16,alignItems:"center",justifyContent:"center"},
  closeBtnText:{color:"#fff",fontSize:14},
  letterRow:{flexDirection:"row",minHeight:260},
  imageCol:{width:"38%"},
  letterImage:{width:"100%",height:"100%",minHeight:260},
  imagePlaceholder:{flex:1,minHeight:260,backgroundColor:"#ddd",alignItems:"center",justifyContent:"center"},
  imagePlaceholderText:{fontSize:40},
  textCol:{flex:1,padding:16,gap:10,justifyContent:"center"},
  modalQuestion:{fontSize:13,fontWeight:"600",color:"#333",lineHeight:20},
  summaryText:{fontSize:12,color:"#555",lineHeight:19},
  noLetterText:{fontSize:12,color:"#999",fontStyle:"italic"},
  quoteBlock:{borderLeftWidth:3,borderLeftColor:"#8B4513",paddingLeft:8,marginTop:4},
  quoteText:{fontSize:12,color:"#555",fontStyle:"italic",lineHeight:18},
  quoteSource:{fontSize:11,color:"#888",textAlign:"right",marginTop:4},
  modalFooter:{padding:16,gap:10,alignItems:"center"},
  shareBtn:{backgroundColor:"#2d5a3d",borderRadius:24,paddingVertical:12,paddingHorizontal:24,alignItems:"center",width:"100%"},
  shareBtnText:{color:"#fff",fontSize:14,fontWeight:"600"},
  letterDate:{color:"#999",fontSize:12,textAlign:"center"},
  conversationHint:{alignItems:"center",paddingVertical:4},
  conversationHintText:{color:"#8B4513",fontSize:13},
  convOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"},
  convPanel:{backgroundColor:"#fff",borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:SCREEN_H*0.7,padding:20},
  convHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  convTitle:{fontSize:16,fontWeight:"bold",color:"#333"}, convClose:{fontSize:20,color:"#888"},
  convScroll:{flex:1}, convText:{color:"#444",fontSize:14,lineHeight:22},
});