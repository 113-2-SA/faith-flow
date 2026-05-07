import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { API_BASE_URL } from '../../lib/api';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';
import { toDateOnlyCST } from '../../utils/dateUtils';

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
  const [saving, setSaving] = useState(false);

  // 編輯模式
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editBibleQuote, setEditBibleQuote] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

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
    } catch {
      Alert.alert('錯誤', '無法取得日記');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const enterEditMode = () => {
    if (!diary) return;
    setEditDate(diary.diary_date ?? '');
    setEditTitle(diary.diary_title ?? '');
    setEditContent(diary.diary_content ?? '');
    setEditBibleQuote(diary.bible_quote ?? '');
    setEditTags(Array.isArray(diary.tags) ? [...diary.tags] : []);
    setTagInput('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      Alert.alert('錯誤', '請輸入標題');
      return;
    }
    if (!editContent.trim()) {
      Alert.alert('錯誤', '請輸入內容');
      return;
    }

    setSaving(true);
    try {
      const token = await user!.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diary_date: editDate,
          diary_title: editTitle.trim(),
          diary_content: editContent.trim(),
          bible_quote: editBibleQuote.trim() || null,
          tags: editTags.length > 0 ? editTags : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDiary(data.data);
        setIsEditing(false);
      } else {
        Alert.alert('錯誤', data.error ?? '更新失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !editTags.includes(t)) {
      setEditTags([...editTags, t]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
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

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除這篇日記嗎？')) doDelete();
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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <GlassCard style={styles.header}>
            {isEditing ? (
              <View style={styles.headerBtn} />
            ) : (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                <Text style={styles.backIcon}>‹</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.headerTitle}>{isEditing ? '編輯日記' : '日記'}</Text>

            {isEditing ? (
              <View style={styles.headerEditActions}>
                <TouchableOpacity style={styles.addTagBtn} onPress={cancelEdit}>
                  <Text style={styles.addTagText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addTagBtn} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator size="small" color="rgba(135,206,250,0.9)" />
                    : <Text style={styles.saveText}>儲存</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={enterEditMode} style={styles.headerBtn}>
                <Text style={styles.editIcon}>✎</Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          {/* Content */}
          <GlassCard style={styles.card}>
            {/* 日期 */}
            {isEditing ? (
              <>
                <Text style={styles.fieldLabel}>日期</Text>
                <TextInput
                  style={styles.input}
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </>
            ) : (
              <Text style={styles.date}>{toDateOnlyCST(diary.diary_date)}</Text>
            )}

            {/* 標題 */}
            {isEditing ? (
              <>
                <Text style={styles.fieldLabel}>標題 *</Text>
                <TextInput
                  style={styles.input}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="輸入標題"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </>
            ) : (
              <Text style={styles.title}>{diary.diary_title}</Text>
            )}

            {/* 靈感金句 */}
            {isEditing ? (
              <>
                <Text style={styles.fieldLabel}>靈感金句</Text>
                <TextInput
                  style={styles.input}
                  value={editBibleQuote}
                  onChangeText={setEditBibleQuote}
                  placeholder="輸入經文或金句"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                />
              </>
            ) : diary.bible_quote ? (
              <View style={styles.bibleContainer}>
                <Text style={styles.bibleQuote}>📖 {diary.bible_quote}</Text>
              </View>
            ) : null}

            {/* 內容 */}
            {isEditing ? (
              <>
                <Text style={styles.fieldLabel}>內容 *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editContent}
                  onChangeText={setEditContent}
                  placeholder="輸入日記內容..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                  textAlignVertical="top"
                />
              </>
            ) : (
              <Text style={styles.content}>{diary.diary_content}</Text>
            )}

            {/* 標籤 */}
            {isEditing ? (
              <>
                <Text style={styles.fieldLabel}>標籤</Text>
                <View style={styles.tagsContainer}>
                  {editTags.map((tag, index) => (
                    <TouchableOpacity
                      key={`${tag}-${index}`}
                      style={styles.tagEditable}
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
                    placeholder="輸入標籤後按新增"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                    <Text style={styles.addTagText}>新增</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : diary.tags && diary.tags.length > 0 ? (
              <View style={styles.tagsContainer}>
                {diary.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </GlassCard>
        </ScrollView>

        {/* 底部按鈕：閱讀模式顯示分享與刪除，編輯模式隱藏 */}
        {!isEditing && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => router.push(`/community/create?diary_id=${diary.diary_id}` as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.shareBtnText}>分享到心靈營火</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
              onPress={handleDelete}
              disabled={deleting}
              activeOpacity={0.7}
            >
              {deleting
                ? <ActivityIndicator color="rgba(255,180,180,0.9)" />
                : <Text style={styles.deleteBtnText}>刪除</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  headerBtn: {
    minWidth: 48,
    alignItems: 'center',
  },
  headerEditActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 36,
  },
  editIcon: {
    fontSize: 22,
    color: 'rgba(135,206,250,0.95)',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(135,206,250,0.95)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  bottomActions: {
    flexDirection: 'row',
    margin: 16,
    gap: 10,
  },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0,122,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.55)',
    alignItems: 'center',
  },
  shareBtnText: {
    color: 'rgba(135,206,250,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
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
  textArea: {
    height: 180,
    textAlignVertical: 'top',
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
    marginBottom: 4,
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
  tagEditable: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tagText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  tagRemove: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addTagBtn: {
    backgroundColor: 'rgba(135,206,250,0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(135,206,250,0.4)',
  },
  addTagText: {
    color: 'rgba(135,206,250,0.95)',
    fontSize: 14,
    fontWeight: '600',
  },
});
