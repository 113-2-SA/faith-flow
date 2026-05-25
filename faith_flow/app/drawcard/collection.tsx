// app/drawcard/collection.tsx
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList, Image, Modal, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useAuth } from "../context/authcontext";
import { API_BASE_URL } from "../../lib/api";
import { useFocusEffect } from "expo-router";

function formatWeekLabel(weekStart: string): string {
  if (!weekStart) return '未知';
  const dateStr = String(weekStart).substring(0, 10);
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return '未知';
  const end = new Date(year, month - 1, day + 6);
  return `${year} 年 ${month} 月 ${day} 日 ～ ${end.getMonth() + 1} 月 ${end.getDate()} 日`;
}

const THEME_LABELS: Record<string, string> = {
  FAITH_SELF:      '信仰與自我認識',
  SOCIETY_TECH:    '科技與現代社會',
  ECONOMY_JUSTICE: '經濟正義',
  RELATIONSHIP:    '人際關係與愛德',
  SUFFERING_HOPE:  '苦難與基督徒的希望',
  CREATION_ENV:    '受造界保護',
};

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

  const fetchCards = useCallback(async () => {
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
  }, [currentUser]);

  useFocusEffect(useCallback(() => { fetchCards(); }, [fetchCards]));

  const totalCompleted = weekGroups.reduce((sum, g) => sum + g.cards.length, 0);

  const shareToFire = () => {
    if (!selectedCard) return;
    router.push(`/community/create?user_draws_id=${selectedCard.user_draws_id}` as never);
    setSelectedCard(null);
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
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
            <Text style={styles.emptyIcon}>🌿</Text>
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
                    <Pressable
                      key={card.user_draws_id}
                      style={styles.cardThumb}
                      onPress={() => setSelectedCard(card)}
                    >
                      {card.image_url ? (
                        <Image
                          source={{ uri: card.image_url }}
                          style={styles.cardThumbImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.cardThumbPlaceholder}>
                          <Text style={styles.cardThumbDay}>Day {card.day}</Text>
                        </View>
                      )}
                      <View style={styles.cardThumbBadge}>
                        <Text style={styles.cardThumbBadgeText}>✓</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>

      {/* 底部詳情 Modal */}
      <Modal
        visible={!!selectedCard}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCard(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDayLabel}>
                  第 {selectedCard?.day} 天
                  <Text style={styles.modalTheme}>
                    {THEME_LABELS[selectedCard?.theme ?? ''] ?? selectedCard?.theme ?? ''}
                  </Text>
                </Text>
                {selectedCard?.weekly_start_date && (
                  <Text style={styles.modalWeekLabel}>
                    {formatWeekLabel(selectedCard.weekly_start_date)}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedCard(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 卡片圖 + 問題 */}
              <View style={styles.cardPreviewRow}>
                {selectedCard?.image_url ? (
                  <Image
                    source={{ uri: selectedCard.image_url }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Text style={{ fontSize: 32 }}>🖼️</Text>
                  </View>
                )}
                <View style={styles.cardPreviewText}>
                  <Text style={styles.modalQuestion}>{selectedCard?.question}</Text>
                  {selectedCard?.created_at && (
                    <Text style={styles.modalDate}>
                      {new Date(selectedCard.created_at).toLocaleDateString('zh-TW')}
                    </Text>
                  )}
                </View>
              </View>

              {/* 信箋摘要 */}
              {selectedCard?.summary ? (
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>信箋摘要</Text>
                  <Text style={styles.summaryText}>{selectedCard.summary}</Text>
                </View>
              ) : (
                <View style={styles.summaryBlock}>
                  <Text style={styles.noSummaryText}>尚未完成對話，信箋未生成</Text>
                </View>
              )}

              {/* 金句 */}
              {selectedCard?.quote && (
                <View style={styles.quoteBlock}>
                  <Text style={styles.quoteText}>「{selectedCard.quote}」</Text>
                  <Text style={styles.quoteSource}>—— {selectedCard.quote_source}</Text>
                </View>
              )}

              {/* 按鈕區 */}
              <View style={styles.actionRow}>
                {selectedCard?.summary && (
                  <TouchableOpacity style={styles.shareBtn} onPress={shareToFire}>
                    <Text style={styles.shareBtnText}>🔥 分享到心靈營火</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backText: { color: "#fff", fontSize: 22 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  totalLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginBottom: 16 },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  emptyHint: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", lineHeight: 20 },

  groupList: { paddingHorizontal: 20, paddingBottom: 40 },
  weekGroup: { marginBottom: 28 },
  weekLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 12, letterSpacing: 0.5 },
  cardRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  cardThumb: { width: 80, height: 116, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.15)" },
  cardThumbImage: { width: "100%", height: "100%" },
  cardThumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardThumbDay: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  cardThumbBadge: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(20,60,30,0.85)", borderRadius: 8,
    width: 18, height: 18, alignItems: "center", justifyContent: "center",
  },
  cardThumbBadgeText: { color: "#7CFC00", fontSize: 10, fontWeight: "bold" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: "#1a2a35",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20,
  },
  modalDayLabel: { fontSize: 15, fontWeight: "700", color: "#fff" },
  modalTheme: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.6)" },
  modalWeekLabel: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  modalClose: { fontSize: 22, color: "rgba(255,255,255,0.6)", lineHeight: 26 },

  cardPreviewRow: { flexDirection: "row", gap: 14, marginBottom: 20 },
  modalImage: { width: 80, height: 116, borderRadius: 12, flexShrink: 0 },
  modalImagePlaceholder: {
    width: 80, height: 116, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardPreviewText: { flex: 1, justifyContent: "center", gap: 8 },
  modalQuestion: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", lineHeight: 21 },
  modalDate: { fontSize: 12, color: "rgba(255,255,255,0.4)" },

  summaryBlock: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, letterSpacing: 1 },
  summaryText: { fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 22 },
  noSummaryText: { fontSize: 13, color: "rgba(255,255,255,0.35)", fontStyle: "italic", textAlign: "center", paddingVertical: 8 },

  quoteBlock: {
    borderLeftWidth: 3, borderLeftColor: "#7CBA8A",
    paddingLeft: 14, marginBottom: 24,
  },
  quoteText: { fontSize: 13, color: "rgba(180,230,180,0.9)", fontStyle: "italic", lineHeight: 20 },
  quoteSource: { fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "right", marginTop: 6 },

  actionRow: { gap: 12 },
  shareBtn: {
    backgroundColor: "#2d5a3d", borderRadius: 30,
    paddingVertical: 14, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(124,186,138,0.4)",
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
