import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { getWeeklySummaries } from '../../lib/weeklysummaryapi';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';
import { toDateOnlyCST } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../lib/api'; 

interface Diary {
  diary_id: number;
  diary_date: string;
  diary_title: string;
  diary_content: string;
  bible_quote: string | null;
  tags: string[] | null;
  created_at: string;
}

export default function DiaryListScreen() {
  const router = useRouter();
  const { currentUser: user } = useAuth();

  // 接收從日曆傳來的日期參數
  const params = useLocalSearchParams();
  const filterDate = params.date as string | undefined;

  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // 搜尋狀態
  const [searchText, setSearchText] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 福音 Modal 狀態
  const [gospelModalVisible, setGospelModalVisible] = useState(false);
  const [gospelSummaries, setGospelSummaries] = useState<{ year: number; week_number: number; start_date: string; end_date: string; bible_quote: string }[]>([]);
  const [gospelLoading, setGospelLoading] = useState(false);

  const formatDate = (dateString: string) => {
    const [, month, day] = dateString.split('-');
    return `${parseInt(month)}/${parseInt(day)}`;
  };

  const handleOpenGospelModal = async () => {
    setGospelModalVisible(true);
    if (gospelSummaries.length > 0) return;
    setGospelLoading(true);
    try {
      const response = await getWeeklySummaries({ limit: 100, offset: 0 });
      if (response.ok && Array.isArray(response.data)) {
        setGospelSummaries(
          response.data.filter((s: any) => s.bible_quote)
        );
      }
    } catch {
      // silent fail
    } finally {
      setGospelLoading(false);
    }
  };

  // 取得日記
  const fetchDiaries = async (date?: string, keyword?: string) => {
    if (!user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      let url = `${API_BASE_URL}/api/diary`;
      const queryParts: string[] = [];

      if (date) queryParts.push(`date=${date}`);
      if (keyword && keyword.trim()) queryParts.push(`keyword=${encodeURIComponent(keyword.trim())}`);

      if (queryParts.length > 0) url += `?${queryParts.join('&')}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.ok) {
        setDiaries(data.data.items);
        setTotalCount(data.data.pagination.total);
      } else {
        Alert.alert('錯誤', data.error);
      }
    } catch (error) {
      console.error('❌ 取得日記失敗:', error);
      Alert.alert('錯誤', '無法取得日記');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setSearchText('');
      setActiveKeyword('');
      fetchDiaries(filterDate, '');
    }, [filterDate, user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDiaries(filterDate, activeKeyword);
  };

  // 搜尋輸入防抖
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setActiveKeyword(text);
      fetchDiaries(filterDate, text);
    }, 500);
  };

  const handleSearchClear = () => {
    setSearchText('');
    setActiveKeyword('');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    fetchDiaries(filterDate, '');
  };

  // 渲染單篇日記
  const renderDiary = ({ item }: { item: Diary }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/diary/[id]', params: { id: item.diary_id } })}
    >
      <GlassCard style={styles.diaryCard}>
        <Text style={styles.diaryDate}>{toDateOnlyCST(item.diary_date)}</Text>
        <Text style={styles.diaryTitle}>{item.diary_title}</Text>
        <Text style={styles.diaryContent} numberOfLines={2}>
          {item.diary_content}
        </Text>
        {item.bible_quote && (
          <Text style={styles.bibleQuote} numberOfLines={1}>
            📖 {item.bible_quote}
          </Text>
        )}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>
      <View style={styles.container}>
        {/* 頂部區域：篩選資訊 + 搜尋欄 */}
        <View style={styles.headerArea}>
          {/* 日期篩選列（只在日期模式下顯示） */}
          {filterDate ? (
            <GlassCard style={styles.filterBar}>
              <View style={styles.filterContent}>
                <View>
                  <Text style={styles.filterDate}>📅 {filterDate}</Text>
                  <Text style={styles.filterCount}>{totalCount} 篇日記</Text>
                </View>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backButtonText}>返回</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <View style={styles.allDiariesHeader}>
              <Text style={styles.allDiariesTitle}>我的日記</Text>
              <Text style={styles.filterCount}>{totalCount} 篇</Text>
            </View>
          )}

          {/* 週統整入口 */}
          <View style={styles.weeklyButtonRow}>
            <TouchableOpacity
              style={styles.weeklyBtn}
              onPress={() => router.push('/diary/weeklysummary')}
            >
              <GlassCard style={styles.weeklyCard}>
                <View style={styles.weeklyRow}>
                  <Text style={styles.weeklyIcon}>✨</Text>
                  <View style={styles.weeklyText}>
                    <Text style={styles.weeklyTitle}>週統整</Text>
                    <Text style={styles.weeklySub}>查看 AI 自動生成的每週祈禱回顧</Text>
                  </View>
                  <Text style={styles.weeklyArrow}>›</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gospelButton} onPress={handleOpenGospelModal}>
              <Text style={styles.gospelButtonText}>📖</Text>
            </TouchableOpacity>
          </View>

          {/* 搜尋欄 */}
          <GlassCard style={styles.searchCard}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="搜尋標題、內容、標籤..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={searchText}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                clearButtonMode="never"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={handleSearchClear} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {activeKeyword.trim() !== '' && (
              <Text style={styles.searchHint}>
                「{activeKeyword}」共 {totalCount} 筆結果
              </Text>
            )}
          </GlassCard>
        </View>

        {/* 載入中 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        ) : (
          <FlatList
            data={diaries}
            renderItem={renderDiary}
            keyExtractor={(item) => item.diary_id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
            ListEmptyComponent={
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyText}>
                  {activeKeyword
                    ? `找不到包含「${activeKeyword}」的日記`
                    : filterDate
                      ? `${filterDate} 還沒有日記`
                      : '還沒有日記'}
                </Text>
                {!activeKeyword && (
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => router.push({ pathname: '/diary/create', params: filterDate ? { date: filterDate } : {} })}
                  >
                    <Text style={styles.createButtonText}>
                      {filterDate ? '寫下今天的日記' : '開始寫日記'}
                    </Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            }
          />
        )}

        {/* 新增按鈕 */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push({ pathname: '/diary/create', params: filterDate ? { date: filterDate } : {} })}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

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
            {gospelLoading ? (
              <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView style={styles.gospelList} showsVerticalScrollIndicator={false}>
                {gospelSummaries.length === 0 ? (
                  <Text style={styles.gospelEmpty}>還沒有週回顧包含福音金句</Text>
                ) : (
                  gospelSummaries.map((s) => (
                    <View key={`${s.year}-${s.week_number}`} style={styles.gospelItem}>
                      <Text style={styles.gospelWeekLabel}>
                        {s.year} 年 第 {s.week_number} 週　{formatDate(s.start_date)} - {formatDate(s.end_date)}
                      </Text>
                      <Text style={styles.gospelQuote}>「{s.bible_quote}」</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
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
  headerArea: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  filterBar: {
    margin: 16,
    marginBottom: 8,
  },
  filterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterDate: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  filterCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600',
  },
  allDiariesHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  allDiariesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  weeklyButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  weeklyBtn: {
    flex: 1,
  },
  weeklyCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weeklyIcon: {
    fontSize: 22,
  },
  weeklyText: {
    flex: 1,
  },
  weeklyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  weeklySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  weeklyArrow: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '300',
  },
  gospelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gospelButtonText: {
    fontSize: 22,
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
  searchCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    paddingVertical: 2,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  searchHint: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  diaryCard: {
    marginBottom: 16,
  },
  diaryDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  diaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 8,
  },
  diaryContent: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 8,
  },
  bibleQuote: {
    fontSize: 13,
    color: 'rgba(135, 206, 250, 0.9)',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tagText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  emptyCard: {
    marginTop: 60,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  createButtonText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '300',
  },
});
