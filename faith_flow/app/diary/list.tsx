import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';

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
  
  // ⭐ 接收從日曆傳來的日期參數
  const params = useLocalSearchParams();
  const filterDate = params.date as string | undefined;

  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // 取得日記
  const fetchDiaries = async (date?: string) => {
    if (!user) {
      console.log('❌ 使用者未登入');
      return;
    }

    setLoading(true);

    try {
      const token = await user.getIdToken();
      
      let url = 'http://localhost:3000/api/diary';
      if (date) {
        url += `?date=${date}`;
        console.log('📅 篩選日期:', date);
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.ok) {
        setDiaries(data.data.items);
        setTotalCount(data.data.pagination.total);
        console.log(`✅ 取得 ${data.data.items.length} 篇日記`);
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

  useEffect(() => {
    fetchDiaries(filterDate);
  }, [filterDate, user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDiaries(filterDate);
  };

  // 渲染單篇日記
  const renderDiary = ({ item }: { item: Diary }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/diary/[id]', params: { id: item.diary_id } })}
    >
      <GlassCard style={styles.diaryCard}>
        {/* 日期 */}
        <Text style={styles.diaryDate}>{item.diary_date}</Text>
        
        {/* 標題 */}
        <Text style={styles.diaryTitle}>{item.diary_title}</Text>
        
        {/* 內容預覽 */}
        <Text style={styles.diaryContent} numberOfLines={2}>
          {item.diary_content}
        </Text>
        
        {/* 經文 */}
        {item.bible_quote && (
          <Text style={styles.bibleQuote} numberOfLines={1}>
            📖 {item.bible_quote}
          </Text>
        )}
        
        {/* 標籤 */}
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
        {/* 篩選資訊列 */}
        {filterDate && (
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
        )}

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
                  {filterDate 
                    ? `${filterDate} 還沒有日記` 
                    : '還沒有日記'}
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => router.push('/diary/create')}
                >
                  <Text style={styles.createButtonText}>
                    {filterDate ? '寫下今天的日記' : '開始寫日記'}
                  </Text>
                </TouchableOpacity>
              </GlassCard>
            }
          />
        )}

        {/* 新增按鈕 */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/diary/create')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  listContent: {
    padding: 16,
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