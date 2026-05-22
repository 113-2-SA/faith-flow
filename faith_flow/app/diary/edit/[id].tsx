import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/authcontext';
import { API_BASE_URL } from '../../../lib/api';
import { VideoBackground } from '../../../components/VideoBackground';
import { GlassCard } from '../../../components/GlassCard';

export default function EditDiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();

  const [diaryDate, setDiaryDate] = useState('');
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [bibleQuote, setBibleQuote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser || !id) return;
    loadDiary();
  }, [currentUser, id]);

  const loadDiary = async () => {
    try {
      const token = await currentUser!.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        const d = data.data;
        setDiaryDate(d.diary_date ?? '');
        setDiaryTitle(d.diary_title ?? '');
        setDiaryContent(d.diary_content ?? '');
        setBibleQuote(d.bible_quote ?? '');
        setTags(Array.isArray(d.tags) ? d.tags : []);
      } else {
        Alert.alert('錯誤', data.error ?? '無法載入日記');
        router.back();
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!diaryTitle.trim()) {
      Alert.alert('錯誤', '請輸入標題');
      return;
    }
    if (!diaryContent.trim()) {
      Alert.alert('錯誤', '請輸入內容');
      return;
    }

    setSubmitting(true);
    try {
      const token = await currentUser!.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diary_date: diaryDate,
          diary_title: diaryTitle.trim(),
          diary_content: diaryContent.trim(),
          bible_quote: bibleQuote.trim() || null,
          tags: tags.length > 0 ? tags : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        router.back();
      } else {
        Alert.alert('錯誤', data.error ?? '更新失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <VideoBackground source={require('../../../assets/backgrounds/main.mp4')}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground source={require('../../../assets/backgrounds/main.mp4')}>
      <View style={styles.screen}>
        {/* Header */}
        <GlassCard style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>編輯日記</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={submitting}
            style={styles.headerBtn}
          >
            {submitting
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
              : <Text style={styles.saveText}>儲存</Text>
            }
          </TouchableOpacity>
        </GlassCard>

        <ScrollView contentContainerStyle={styles.container} keyboardDismissMode="on-drag">
          <GlassCard style={styles.card}>
            {/* 日期 */}
            <Text style={styles.label}>日期</Text>
            <TextInput
              style={styles.input}
              value={diaryDate}
              onChangeText={setDiaryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            {/* 標題 */}
            <Text style={styles.label}>標題 *</Text>
            <TextInput
              style={styles.input}
              value={diaryTitle}
              onChangeText={setDiaryTitle}
              placeholder="輸入標題"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            {/* 靈感福音 */}
            <Text style={styles.label}>靈感福音</Text>
            <TextInput
              style={styles.input}
              value={bibleQuote}
              onChangeText={setBibleQuote}
              placeholder="輸入經文或福音"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
            />

            {/* 內容 */}
            <Text style={styles.label}>內容 *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={diaryContent}
              onChangeText={setDiaryContent}
              placeholder="輸入日記內容..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              textAlignVertical="top"
            />

            {/* 標籤 */}
            <Text style={styles.label}>標籤</Text>
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity
                  key={`${tag}-${index}`}
                  style={styles.tag}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                  <Text style={styles.tagRemove}> ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="輸入標籤"
                placeholderTextColor="rgba(255,255,255,0.4)"
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                <Text style={styles.addTagText}>新增</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    marginBottom: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerBtn: { width: 48, alignItems: 'center' },
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
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(135,206,250,0.95)',
  },
  container: { padding: 16 },
  card: { padding: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.95)',
  },
  textArea: { height: 160, textAlignVertical: 'top' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tag: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tagText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  tagRemove: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  addTagBtn: {
    backgroundColor: 'rgba(135,206,250,0.3)',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(135,206,250,0.5)',
  },
  addTagText: {
    color: 'rgba(135,206,250,0.95)',
    fontSize: 15,
    fontWeight: '600',
  },
});
