import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getWeeklySummaries, generateWeeklySummary } from '../api/weeklysummaryapi';
import { VideoBackground } from '@/components/VideoBackground';

interface WeeklySummary {
  summaryID: number;
  userID: number;
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
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  const getLastWeek = () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const year = lastWeek.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const firstSunday = new Date(startOfYear);
    firstSunday.setDate(1 + (7 - startOfYear.getDay()) % 7);
    const weekNumber = Math.ceil(((lastWeek.getTime() - firstSunday.getTime()) / 86400000 + 1) / 7);
    return { year, weekNumber };
  };

  const handleGenerateLastWeek = async () => {
    const { year, weekNumber } = getLastWeek();
    setGenerating(true);
    try {
      const response = await generateWeeklySummary(year, weekNumber);
      if (response.ok) {
        Alert.alert('完成', `第 ${weekNumber} 週的回顧已生成`, [
          { text: '確定', onPress: () => onRefresh() },
        ]);
      } else {
        Alert.alert('無法生成', response.error || '請確認上週有寫日記');
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
    if (loading && !isRefresh) return;

    try {
      const currentOffset = isRefresh ? 0 : offset;
      
      console.log('🔍 開始載入周回顧...', { currentOffset, limit }); // 除錯日誌
      
      const response = await getWeeklySummaries({
        limit,
        offset: currentOffset,
      });

      console.log('📦 收到回應:', response); // 除錯日誌

      if (response.ok) {
        if (isRefresh) {
          setSummaries(response.data);
          setOffset(response.data.length);
        } else {
          setSummaries([...summaries, ...response.data]);
          setOffset(currentOffset + response.data.length);
        }

        setHasMore(response.data.length === limit);
        console.log('✅ 載入成功，共', response.data.length, '筆'); // 除錯日誌
      } else {
        console.error('❌ 載入失敗:', response.error);
        // 不顯示 Alert，靜默處理
      }
    } catch (error) {
      console.error('❌ 載入錯誤:', error);
    } finally {
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
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
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
        key={summary.summaryID}
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
            {summary.is_auto_generated && (
              <View style={styles.autoBadge}>
                <Text style={styles.autoBadgeText}>🤖</Text>
              </View>
            )}
          </View>

          {/* 標題 */}
          <Text style={styles.summaryTitle} numberOfLines={1}>
            {summary.summary_title}
          </Text>

          {/* 內容預覽 */}
          <Text style={styles.summaryPreview} numberOfLines={3}>
            {summary.summary_content}
          </Text>

          {/* 聖經金句預覽 */}
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
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateLastWeek}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>✨ 生成上週回顧</Text>
            )}
          </TouchableOpacity>
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
  generateButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    minWidth: 140,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});