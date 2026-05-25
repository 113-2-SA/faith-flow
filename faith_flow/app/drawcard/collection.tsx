// app/drawcard/collection.tsx
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/authcontext";
import { API_BASE_URL } from "../../lib/api";

const { height: SCREEN_H } = Dimensions.get("window");

function formatWeekLabel(weekStart: string): string {
  if (!weekStart) return '未知';
  const dateStr = String(weekStart).substring(0, 10);
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '未知';
  const end = new Date(year, month - 1, day + 6);
  const endMonth = end.getMonth() + 1;
  const endDay = end.getDate();
  return `${year} 年 ${month} 月 ${day} 日 ~ ${endMonth} 月 ${endDay} 日`;
}

type CardItem = {
  user_draws_id: number;
  day: number;
  id: number;
  weekly_card_id?: number;
  weekly_start_date?: string;
  question: string;
  theme: string;
  quote: string;
  quote_source: string;
  image_url?: string;
  summary?: string | null;
  is_completed?: boolean;
  created_at?: string;
};

type WeekGroup = {
  weekStart: string;
  weekLabel: string;
  cards: CardItem[];
};

export default function CollectionScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  useEffect(() => { fetchCards(); }, []);

  const fetchCards = async () => {
    try {
      if (!currentUser) return;
      const token = await currentUser.getIdToken(true);
      const res = await fetch(API_BASE_URL + "/api/livingwater/my-collection", {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (data.success) {
        const grouped: Record<string, CardItem[]> = {};
        (data.data as CardItem[]).filter(card => card.is_completed).forEach(card => {
          const key = card.weekly_start_date || 'unknown';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(card);
        });
        const groups = Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([weekStart, cards]) => ({
            weekStart,
            weekLabel: formatWeekLabel(weekStart),
            cards: [...cards].sort((a, b) => a.day - b.day),
          }));
        setWeekGroups(groups);
      }
    } catch (err) {
      console.error("[Collection] fetchCards failed:", err);
    }
  };

  const openCard = (card: CardItem) => setSelectedCard(card);
  const closeCard = () => setSelectedCard(null);

  const shareToFire = () => {
    if (!selectedCard) return;
    router.push('/community/create' as never);
    closeCard();
  };

  const totalCompleted = weekGroups.reduce((sum, g) => sum + g.cards.filter(c => c.is_completed).length, 0);

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>卡片收藏</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.totalLabel}>共收藏 {totalCompleted} 張信箋</Text>

        {weekGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>尚無收藏紀錄</Text>
            <Text style={styles.emptyHint}>完成活水泉源的對話後，卡片將累積於此</Text>
          </View>
        ) : (
          <FlatList
            data={weekGroups}
            keyExtractor={g => g.weekStart}
            contentContainerStyle={styles.groupList}
            renderItem={({ item: group }) => (
              <View style={styles.weekGroup}>
                <Text style={styles.weekLabel}>{group.weekLabel}</Text>
                <View style={styles.cardRow}>
                  {group.cards.map(card => (
                    <Pressable key={card.user_draws_id} style={styles.cardThumb} onPress={() => openCard(card)}>
                      {card.image_url ? (
                        <Image source={{ uri: card.image_url }} style={styles.cardThumbImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.cardThumbPlaceholder}>
                          <Text style={styles.cardThumbDay}>Day {card.day}</Text>
                        </View>
                      )}
                      {card.is_completed && (
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>✓</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          />
        )}

        {/* 卡片詳情 Modal */}
        <Modal visible={!!selectedCard} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Pressable style={styles.closeBtn} onPress={closeCard}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.letterRow}>
                  <View style={styles.imageCol}>
                    {selectedCard?.image_url ? (
                      <Image source={{ uri: selectedCard.image_url }} style={styles.letterImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>📷</Text>
                      </View>
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
                  {selectedCard?.created_at && (
                    <Text style={styles.letterDate}>
                      {new Date(selectedCard.created_at).toLocaleDateString("zh-TW")} 的信箋
                    </Text>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#2d5a3d" },
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backText: { color: "#fff", fontSize: 22 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  totalLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", marginBottom: 16 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  emptyHint: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", lineHeight: 20 },
  groupList: { paddingHorizontal: 20, paddingBottom: 20 },
  weekGroup: { marginBottom: 24 },
  weekLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 10 },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardThumb: { width: 80, height: 116, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.2)" },
  cardThumbImage: { width: "100%", height: "100%" },
  cardThumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardThumbDay: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  completedBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(20,60,30,0.85)", borderRadius: 8, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  completedBadgeText: { color: "#7CFC00", fontSize: 10, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", maxHeight: SCREEN_H * 0.85, backgroundColor: "#f5f0e8", borderRadius: 20, overflow: "hidden" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 10, backgroundColor: "rgba(0,0,0,0.3)", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 14 },
  letterRow: { flexDirection: "row", minHeight: 260 },
  imageCol: { width: "38%" },
  letterImage: { width: "100%", height: "100%", minHeight: 260 },
  imagePlaceholder: { flex: 1, minHeight: 260, backgroundColor: "#ddd", alignItems: "center", justifyContent: "center" },
  imagePlaceholderText: { fontSize: 40 },
  textCol: { flex: 1, padding: 16, gap: 10, justifyContent: "center" },
  modalQuestion: { fontSize: 13, fontWeight: "600", color: "#333", lineHeight: 20 },
  summaryText: { fontSize: 12, color: "#555", lineHeight: 19 },
  noLetterText: { fontSize: 12, color: "#999", fontStyle: "italic" },
  quoteBlock: { borderLeftWidth: 3, borderLeftColor: "#8B4513", paddingLeft: 8, marginTop: 4 },
  quoteText: { fontSize: 12, color: "#555", fontStyle: "italic", lineHeight: 18 },
  quoteSource: { fontSize: 11, color: "#888", textAlign: "right", marginTop: 4 },
  modalFooter: { padding: 16, gap: 10, alignItems: "center" },
  shareBtn: { backgroundColor: "#2d5a3d", borderRadius: 24, paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", width: "100%" },
  shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  letterDate: { color: "#999", fontSize: 12, textAlign: "center" },
});
