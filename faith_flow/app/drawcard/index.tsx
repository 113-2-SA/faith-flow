// app/drawcard/index.tsx
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/authcontext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 80) / 5;
const CARD_H = CARD_W * 1.55;

type WeeklyCard = {
  weekly_card_id: number; day: number; id: number; question: string;
  theme: string; depth?: string; quote: string; quote_source: string; image_url?: string;
};

const DAY_LABELS = ['一', '二', '三', '四', '五'];

export default function DrawCardScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [cards, setCards] = useState<WeeklyCard[]>([]);
  const [drawnCardIds, setDrawnCardIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WeeklyCard | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const weeklyRes = await fetch(`${API_BASE}/api/livingwater/weekly-cards`);
      const weeklyData = await weeklyRes.json();
      if (weeklyData.success) setCards(weeklyData.data);

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          const drawsRes = await fetch(`${API_BASE}/api/livingwater/my-draws`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const drawsData = await drawsRes.json();
          if (drawsData.success) setDrawnCardIds(drawsData.drawn_card_ids || []);
        } catch (err) { console.warn('[DrawCard] 取得抽卡記錄失敗:', err); }
      }
    } catch (err) { console.error('[DrawCard] fetchData failed:', err); }
    finally { setLoading(false); }
  };

  const handleCardPress = async (card: WeeklyCard) => {
    if (drawnCardIds.includes(card.weekly_card_id)) return;
    setSelectedCard(card);
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken(true);
        await fetch(`${API_BASE}/api/livingwater/record-draw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ weekly_card_id: card.weekly_card_id }),
        });
      } catch (err) { console.warn('[DrawCard] 記錄抽卡失敗:', err); }
    }
  };

  const allDrawn = cards.length > 0 && cards.every(c => drawnCardIds.includes(c.weekly_card_id));

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#fff" /></View>;

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✨ 活水泉源</Text>
          <Text style={styles.headerSub}>本週靈修抽卡</Text>
        </View>
        {!selectedCard ? (
          <View style={styles.cardArea}>
            {allDrawn ? (
              <Text style={styles.hint}>🎉 本週抽卡已結束！{'\n'}下週再來繼續靈修之旅</Text>
            ) : (
              <Text style={styles.hint}>點擊卡片開始今日靈修對話</Text>
            )}
            <View style={styles.cardRow}>
              {[1,2,3,4,5].map((day) => {
                const card = cards.find(c => c.day === day);
                const isDrawn = card ? drawnCardIds.includes(card.weekly_card_id) : false;
                const canPress = !!card && !isDrawn;
                return (
                  <Pressable key={day}
                    style={[styles.card, isDrawn ? styles.cardDrawn : styles.cardAvailable]}
                    onPress={() => card && canPress && handleCardPress(card)}
                    disabled={!canPress}>
                    <Text style={[styles.cardDayLabel, !isDrawn && styles.cardDayLabelAvailable]}>週{DAY_LABELS[day-1]}</Text>
                    {isDrawn && <Text style={styles.cardDoneIcon}>✓</Text>}
                    {!isDrawn && card && <Text style={styles.cardTapHint}>點我{'\n'}抽卡</Text>}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor:'rgba(255,255,255,0.85)'}]}/><Text style={styles.legendText}>未抽</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, {backgroundColor:'rgba(255,255,255,0.3)'}]}/><Text style={styles.legendText}>已抽</Text></View>
            </View>
          </View>
        ) : (
          <View style={styles.revealArea}>
            <View style={styles.revealCard}>
              <Text style={styles.themeText}>{selectedCard.theme}</Text>
              <Text style={styles.questionText}>{selectedCard.question}</Text>
              <Text style={styles.quoteText}>「{selectedCard.quote}」</Text>
              <Text style={styles.quoteSourceText}>——{selectedCard.quote_source}</Text>
            </View>
            <Pressable style={styles.startBtn} onPress={() => router.push({
              pathname: '/drawcard/chat',
              params: {
                questionId: selectedCard.id,
                weekly_card_id: selectedCard.weekly_card_id,
                question: selectedCard.question,
                theme: selectedCard.theme,
                quote: selectedCard.quote,
                quote_source: selectedCard.quote_source,
                image_url: selectedCard.image_url || '',
              },
            })}>
              <Text style={styles.startBtnText}>開啟對話 ✨</Text>
            </Pressable>
            <Pressable style={styles.backBtn} onPress={() => setSelectedCard(null)}>
              <Text style={styles.backBtnText}>← 返回</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.collectionBtn} onPress={() => router.push('/drawcard/collection')}>
          <Text style={styles.collectionIcon}>⊞</Text>
          <Text style={styles.collectionText}>卡片&信箋</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg:{flex:1,backgroundColor:'#2d5a3d'}, safe:{flex:1},
  loadingContainer:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#2d5a3d'},
  header:{alignItems:'center',paddingTop:60,paddingBottom:16},
  headerTitle:{color:'#fff',fontSize:22,fontWeight:'700',textShadowColor:'rgba(0,0,0,0.4)',textShadowOffset:{width:0,height:1},textShadowRadius:3},
  headerSub:{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:4},
  cardArea:{flex:1,alignItems:'center',justifyContent:'center',gap:24,paddingHorizontal:16},
  hint:{color:'rgba(255,255,255,0.9)',fontSize:14,textAlign:'center',lineHeight:22},
  cardRow:{flexDirection:'row',gap:8,alignItems:'flex-end'},
  card:{width:CARD_W,height:CARD_H,borderRadius:12,alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.3,shadowRadius:8,elevation:6,padding:4,gap:8},
  cardAvailable:{backgroundColor:'rgba(255,255,255,0.85)',borderWidth:2,borderColor:'#FFD700'},
  cardDrawn:{backgroundColor:'rgba(255,255,255,0.25)'},
  cardDayLabel:{color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'600'},
  cardDayLabelAvailable:{color:'#2d5a3d',fontWeight:'700'},
  cardTapHint:{color:'#2d5a3d',fontSize:11,fontWeight:'600',textAlign:'center',lineHeight:16},
  cardDoneIcon:{color:'rgba(255,255,255,0.7)',fontSize:20},
  legend:{flexDirection:'row',gap:16,marginTop:8},
  legendItem:{flexDirection:'row',alignItems:'center',gap:6},
  legendDot:{width:10,height:10,borderRadius:5},
  legendText:{color:'rgba(255,255,255,0.6)',fontSize:11},
  revealArea:{flex:1,alignItems:'center',justifyContent:'center',gap:20,paddingHorizontal:32},
  revealCard:{width:'100%',borderRadius:16,backgroundColor:'rgba(20,20,40,0.82)',padding:24,alignItems:'center',gap:12},
  themeText:{color:'rgba(255,255,255,0.6)',fontSize:12,letterSpacing:1},
  questionText:{color:'#fff',fontSize:15,lineHeight:24,textAlign:'center'},
  quoteText:{color:'rgba(255,255,255,0.8)',fontSize:13,fontStyle:'italic',textAlign:'center',marginTop:8},
  quoteSourceText:{color:'rgba(255,255,255,0.5)',fontSize:12,textAlign:'center'},
  startBtn:{paddingVertical:14,paddingHorizontal:40,borderRadius:24,backgroundColor:'rgba(255,255,255,0.2)',borderWidth:1,borderColor:'rgba(255,255,255,0.5)'},
  startBtnText:{color:'#fff',fontSize:16,fontWeight:'600'},
  backBtn:{paddingVertical:8,paddingHorizontal:20},
  backBtnText:{color:'rgba(255,255,255,0.6)',fontSize:14},
  collectionBtn:{alignItems:'center',paddingBottom:32},
  collectionIcon:{fontSize:28,color:'rgba(255,255,255,0.85)'},
  collectionText:{color:'rgba(255,255,255,0.85)',fontSize:12,marginTop:2},
});