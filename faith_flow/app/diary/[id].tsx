import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { API_BASE_URL } from '../../lib/api';
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

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser: user } = useAuth();

  const [diary, setDiary] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    fetchDiary();
  }, [id, user]);

  const fetchDiary = async () => {
    try {
      const token = await user!.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/diary/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.ok) {
        setDiary(data.data);
      } else {
        Alert.alert('錯誤', data.error ?? '無法取得日記');
        router.back();
      }
    } catch (error) {
      console.error('取得日記失敗:', error);
      Alert.alert('錯誤', '無法取得日記');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const token = await user!.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        router.back();
      } else {
        Alert.alert('錯誤', data.error ?? '刪除失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除這篇日記嗎？')) await doDelete();
      return;
    }
    Alert.alert('刪除日記', '確定要刪除這篇日記嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: doDelete },
    ]);
  };

  if (loading) {
    return (
      <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      </VideoBackground>
    );
  }

  if (!diary) return null;

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <GlassCard style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>日記</Text>
            <View style={styles.backBtn} />
          </GlassCard>

          {/* Content */}
          <GlassCard style={styles.card}>
            <Text style={styles.date}>{diary.diary_date}</Text>
            <Text style={styles.title}>{diary.diary_title}</Text>

            {diary.bible_quote ? (
              <View style={styles.bibleContainer}>
                <Text style={styles.bibleQuote}>📖 {diary.bible_quote}</Text>
              </View>
            ) : null}

            <Text style={styles.content}>{diary.diary_content}</Text>

            {diary.tags && diary.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {diary.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        </ScrollView>

        {/* 刪除按鈕 — 固定在底部，不在 ScrollView 內 */}
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.7}
        >
          {deleting
            ? <ActivityIndicator color="rgba(255,180,180,0.9)" />
            : <Text style={styles.deleteBtnText}>刪除日記</Text>
          }
        </TouchableOpacity>
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  deleteBtn: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.5)',
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    color: 'rgba(255,180,180,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    padding: 20,
  },
  date: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 16,
  },
  bibleContainer: {
    backgroundColor: 'rgba(135,206,250,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(135,206,250,0.7)',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  bibleQuote: {
    fontSize: 14,
    color: 'rgba(135,206,250,0.95)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  content: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 26,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
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
});
