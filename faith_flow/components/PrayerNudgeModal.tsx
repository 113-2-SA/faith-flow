// ==================== components/PrayerNudgeModal.tsx ====================
// 禱告回顧光點彈窗
// 流程：光點動畫（可點擊預覽）→ 回顧卡片（含相關日記列表）→ 隨機評分

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import {
  NudgeData,
  PastEntry,
  markNudgeShown,
  recordNudgeAction,
  submitNudgeFeedback,
} from '../lib/nudgeApi';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  nudge: NudgeData;
  onClose: () => void;
  onStartConversation: () => void;
}

type Phase = 'dots' | 'card' | 'feedback';

export function PrayerNudgeModal({ nudge, onClose, onStartConversation }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('dots');
  // 點擊光點後展開的日記預覽
  const [selectedEntry, setSelectedEntry] = useState<PastEntry | null>(null);

  const dotAnims = useRef(
    nudge.past_entries.map(() => new Animated.Value(0))
  ).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    markNudgeShown(nudge.nudge_id).catch(() => {});
  }, []);

  useEffect(() => {
    const sequence = dotAnims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(i * 350),
        Animated.spring(anim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ])
    );
    Animated.stagger(0, sequence).start(() => {
      setTimeout(() => {
        setPhase('card');
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, 600);
    });
  }, []);

  const handleDismiss = async () => {
    await recordNudgeAction(nudge.nudge_id, 'dismissed').catch(() => {});
    if (Math.random() < 0.33) {
      setPhase('feedback');
    } else {
      onClose();
    }
  };

  const handleStartConversation = async () => {
    await recordNudgeAction(nudge.nudge_id, 'conversation_started').catch(() => {});
    onClose();
    onStartConversation();
  };

  const handleFeedback = async (rating: 1 | 2 | 3) => {
    await submitNudgeFeedback(nudge.nudge_id, rating).catch(() => {});
    onClose();
  };

  // 關閉 modal 後導向該篇日記
  const handleNavigateToDiary = (diaryId: number) => {
    onClose();
    router.push(`/diary/${diaryId}`);
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={styles.overlay}>
        {/* 光點時間軸 */}
        <View style={styles.dotsContainer}>
          <Text style={styles.dotsLabel}>你的禱告歷程</Text>
          <View style={styles.dotsRow}>
            {nudge.past_entries.map((entry, i) => {
              const isPositive = entry.emotion_score >= 0.5;
              const dotColor = isPositive
                ? `rgba(255, 220, 100, ${0.5 + entry.emotion_score * 0.5})`
                : `rgba(160, 180, 220, ${0.3 + entry.emotion_score * 0.4})`;
              const isSelected = selectedEntry?.diary_id === entry.diary_id;

              return (
                <React.Fragment key={entry.diary_id}>
                  {i > 0 && <View style={styles.dotLine} />}
                  <TouchableOpacity
                    onPress={() => setSelectedEntry(isSelected ? null : entry)}
                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  >
                    <Animated.View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: dotColor,
                          opacity: dotAnims[i],
                          transform: [{ scale: dotAnims[i] }],
                          shadowColor: dotColor,
                          shadowOpacity: isPositive ? 0.9 : 0.4,
                          shadowRadius: isPositive ? 10 : 5,
                        },
                        isSelected && styles.dotSelected,
                      ]}
                    />
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          {/* 點擊光點後的日記預覽卡 */}
          {selectedEntry && (
            <View style={styles.entryPreview}>
              <View style={styles.entryPreviewHeader}>
                <Text style={styles.entryPreviewDate}>{selectedEntry.diary_date}</Text>
                <View style={styles.entryEmotionTag}>
                  <Text style={styles.entryEmotionText}>{selectedEntry.emotion_label}</Text>
                </View>
              </View>
              <Text style={styles.entryPreviewTitle} numberOfLines={2}>
                {selectedEntry.diary_title}
              </Text>
              <TouchableOpacity
                style={styles.entryViewBtn}
                onPress={() => handleNavigateToDiary(selectedEntry.diary_id)}
              >
                <Text style={styles.entryViewText}>查看這篇日記 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 日期範圍標籤 */}
          {nudge.past_entries.length > 0 && !selectedEntry && (
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{nudge.past_entries[0].diary_date}</Text>
              {nudge.past_entries.length > 1 && (
                <Text style={styles.dateLabel}>
                  {nudge.past_entries[nudge.past_entries.length - 1].diary_date}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 回顧卡片 */}
        {phase === 'card' && (
          <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.themeTag}>
                <Text style={styles.themeText}>{nudge.theme}</Text>
              </View>

              <Text style={styles.trendText}>{nudge.emotion_trend}</Text>
              <Text style={styles.insightText}>{nudge.ai_insight}</Text>

              {/* 相關日記列表 */}
              <View style={styles.entriesSection}>
                <Text style={styles.entriesSectionLabel}>你曾在這些時刻寫過</Text>
                {nudge.past_entries.map((entry) => (
                  <TouchableOpacity
                    key={entry.diary_id}
                    style={styles.entryRow}
                    onPress={() => handleNavigateToDiary(entry.diary_id)}
                  >
                    <View style={styles.entryRowLeft}>
                      <Text style={styles.entryRowDate}>{entry.diary_date}</Text>
                      <Text style={styles.entryRowTitle} numberOfLines={1}>
                        {entry.diary_title}
                      </Text>
                    </View>
                    <View style={styles.entryRowRight}>
                      <Text style={styles.entryRowEmotion}>{entry.emotion_label}</Text>
                      <Text style={styles.entryRowArrow}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {nudge.should_ask_question && nudge.question && (
                <View style={styles.questionBox}>
                  <Text style={styles.questionText}>💬 {nudge.question}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
                  <Text style={styles.dismissText}>先不了</Text>
                </TouchableOpacity>
                {nudge.should_ask_question && (
                  <TouchableOpacity style={styles.chatBtn} onPress={handleStartConversation}>
                    <Text style={styles.chatText}>想聊聊 →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* 評分 */}
        {phase === 'feedback' && (
          <View style={styles.card}>
            <Text style={styles.feedbackTitle}>這次回顧有幫助嗎？</Text>
            <View style={styles.feedbackRow}>
              {([
                { rating: 1, emoji: '😞' },
                { rating: 2, emoji: '😐' },
                { rating: 3, emoji: '😊' },
              ] as const).map(({ rating, emoji }) => (
                <TouchableOpacity key={rating} style={styles.feedbackBtn} onPress={() => handleFeedback(rating)}>
                  <Text style={styles.feedbackEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.skipFeedback}>略過</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  dotsContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  dotsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    elevation: 6,
  },
  dotSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  dotLine: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  dateLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },

  // 點擊光點後展開的預覽卡
  entryPreview: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    width: SCREEN_W - 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  entryPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  entryPreviewDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  entryEmotionTag: {
    backgroundColor: 'rgba(255,220,100,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  entryEmotionText: {
    color: 'rgba(255,220,100,0.85)',
    fontSize: 11,
  },
  entryPreviewTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 10,
  },
  entryViewBtn: {
    alignSelf: 'flex-end',
  },
  entryViewText: {
    color: 'rgba(255,220,100,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },

  card: {
    width: SCREEN_W - 48,
    backgroundColor: 'rgba(20, 20, 40, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 24,
    maxHeight: 500,
  },
  themeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,220,100,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  themeText: {
    color: 'rgba(255,220,100,0.9)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  trendText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  insightText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },

  // 相關日記列表
  entriesSection: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
  },
  entriesSectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  entryRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  entryRowDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginBottom: 2,
  },
  entryRowTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  entryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryRowEmotion: {
    color: 'rgba(255,220,100,0.7)',
    fontSize: 11,
  },
  entryRowArrow: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 20,
    fontWeight: '300',
  },

  questionBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  questionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  chatBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,220,100,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,220,100,0.4)',
    alignItems: 'center',
  },
  chatText: {
    color: 'rgba(255,220,100,0.95)',
    fontSize: 14,
    fontWeight: '600',
  },

  feedbackTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  feedbackBtn: { padding: 8 },
  feedbackEmoji: { fontSize: 36 },
  skipFeedback: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
});
