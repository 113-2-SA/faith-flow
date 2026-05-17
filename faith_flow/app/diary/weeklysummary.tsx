import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getWeeklySummaries, generateAllMissingWeeklySummaries } from '../../lib/weeklysummaryapi';
import { VideoBackground } from '@/components/VideoBackground';

interface WeeklySummary {
  summary_id: number;
  user_id: number;
  year: number;
  week_number: number;
  summary_title: string;
  summary_content: string;
  bible_quote: string | null;
  diary_count: number;
  start_date: string;
  end_date: string;
  generated_at: string;
  is_auto_generated: boolean;
}

export default function WeeklySummaryScreen() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gospelModalVisible, setGospelModalVisible] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const loadingRef = useRef(false);

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const response = await generateAllMissingWeeklySummaries();
      if (response.ok) {
        const { generated, failed, total } = response.data;
        if (total === 0) {
          Alert.alert('已是最新', '所有有日記的週都已有回顧了');
        } else {
          const msg = [
            `共掃描到 ${total} 週缺少回顧`,
            `✅ 成功生成 ${generated.length} 週`,
            failed.length > 0 ? `❌ 失敗 ${failed.length} 週` : null,
          ].filter(Boolean).join('\n');
          Alert.alert('完成', msg, [{ text: '確定', onPress: () => onRefresh() }]);
        }
      } else {
        Alert.alert('無法生成', response.error || '請稍後再試');
      }
    } catch {
      Alert.alert('錯誤', '生成失敗，請稍後再試');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async (isRefresh = false) => {
    if (loadingRef.current && !isRefresh) return;
    loadingRef.current = true;

    try {
      const currentOffset = isRefresh ? 0 : offset;
      const response = await getWeeklySummaries({
        limit,
        offset: currentOffset,
      });

      if (response.ok && Array.isArray(response.data)) {
        const data: WeeklySummary[] = response.data;
        if (isRefresh) {
          setSummaries(data);
          setOffset(data.length);
        } else {
          setSummaries((prev) => [...prev, ...data]);
          setOffset(currentOffset + data.length);
        }
        setHasMore(data.length === limit);
      }
    } catch (error) {
      if (__DEV__) console.error('loadSummaries error:', (error as Error)?.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    loadSummaries(true);
  };

  const formatDate = (dateString: string) => {
    const [, month, day] = dateString.split('-');
    return `${parseInt(month)}/${parseInt(day)}`;
  };

  const groupByYear = (summaries: WeeklySummary[]) => {
    return summaries.reduce((acc, summary) => {
      const year = summary.year;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(summary);
      return acc;
    }, {} as Record<number, WeeklySummary[]>);
  };

  const renderSummaryCard = (summary: WeeklySummary) => {
    return (
      <TouchableOpacity
        key={`${summary.year}-${summary.week_number}`}
        onPress={() =>
          router.push(
            `/diary/summarydetail?year=${summary.year}&weekNumber=${summary.week_number}`
          )
        }
        activeOpacity={0.8}
      >
        <BlurView intensity={80} tint="light" style={styles.summaryCard}>
          {/* 頂部標籤 */}
          <View style={styles.cardHeader}>
            <View style={styles.weekBadge}>
              <Text style={styles.weekBadgeText}>第 {summary.week_number} 週</Text>
            </View>
          </View>

          {/* 標題 */}
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {summary.summary_title}
          </Text>

          {/* 內容預覽 */}
          <Text style={styles.summaryPreview} numberOfLines={3}>
            {summary.summary_content}
          </Text>

          {/* 聖經福音預覽 */}
          {summary.bible_quote && (
            <View style={styles.bibleQuotePreview}>
              <Text style={styles.bibleIcon}>📖</Text>
              <Text style={styles.bibleText} numberOfLines={1}>
                {summary.bible_quote}
              </Text>
            </View>
          )}

          {/* 底部資訊 */}
          <View style={styles.cardFooter}>
            <Text style={styles.dateRange}>
              {formatDate(summary.start_date)} - {formatDate(summary.end_date)}
            </Text>
            <Text style={styles.diaryCount}>📝 {summary.diary_count} 篇</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  const renderYearSection = (year: number, yearSummaries: WeeklySummary[]) => {
    return (
      <View key={year} style={styles.yearSection}>
        <Text style={styles.yearHeader}>{year} 年</Text>
        {yearSummaries.map(renderSummaryCard)}
      </View>
    );
  };

  const groupedSummaries = groupByYear(summaries);
  const years = Object.keys(groupedSummaries)
    .map(Number)
    .sort((a, b) => b - a);

  if (loading && summaries.length === 0) {
    return (
      <LinearGradient colors={['#4A90A4', '#6BA587', '#8FBC8F']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

          if (isCloseToBottom && hasMore && !loading) {
            setLoading(true);
            loadSummaries(false);
          }
        }}
        scrollEventThrottle={400}
      >
        {/* 頁面標題 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>我的周回顧</Text>
          <Text style={styles.headerSubtitle}>
            共 {summaries.length} 週的成長記錄
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGenerateAll}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.generateButtonText}>✨ 補齊週回顧</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gospelButton}
              onPress={() => setGospelModalVisible(true)}
            >
              <Text style={styles.gospelButtonText}>📖</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 年份分組列表 */}
        {years.length > 0 ? (
          years.map((year) => renderYearSection(year, groupedSummaries[year]))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>還沒有周回顧</Text>
            <Text style={styles.emptyHint}>
              每週日系統會自動生成上週的回顧
            </Text>
          </View>
        )}

        {/* 載入更多指示器 */}
        {loading && summaries.length > 0 && (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingMoreText}>載入更多...</Text>
          </View>
        )}

        {/* 到底提示 */}
        {!hasMore && summaries.length > 0 && (
          <Text style={styles.endText}>- 已經到底了 -</Text>
        )}
      </ScrollView>
      <Modal
        visible={gospelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGospelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📖 各週福音回顧</Text>
              <TouchableOpacity onPress={() => setGospelModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.gospelList} showsVerticalScrollIndicator={false}>
              {summaries.filter((s) => s.bible_quote).length === 0 ? (
                <Text style={styles.gospelEmpty}>還沒有週回顧包含福音金句</Text>
              ) : (
                summaries
                  .filter((s) => s.bible_quote)
                  .map((s) => (
                    <View key={`${s.year}-${s.week_number}`} style={styles.gospelItem}>
                      <Text style={styles.gospelWeekLabel}>
                        {s.year} 年 第 {s.week_number} 週　{formatDate(s.start_date)} - {formatDate(s.end_date)}
                      </Text>
                      <Text style={styles.gospelQuote}>「{s.bible_quote}」</Text>
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  yearSection: {
    marginBottom: 24,
  },
  yearHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 20,
    marginBottom: 12,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  weekBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  autoBadge: {
    backgroundColor: 'rgba(100, 200, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  autoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  summaryPreview: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
    marginBottom: 12,
  },
  bibleQuotePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  bibleIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  bibleText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateRange: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  diaryCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 10,
    fontSize: 14,
  },
  endText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    paddingVertical: 30,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  generateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 140,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  gospelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gospelButtonText: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a2a35',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalClose: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 26,
  },
  gospelList: {
    paddingHorizontal: 20,
  },
  gospelItem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  gospelWeekLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  gospelQuote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  gospelEmpty: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    paddingVertical: 40,
  },
});