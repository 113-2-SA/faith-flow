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

type Visibility = 'public' | 'friends' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: '公開' },
  { value: 'friends', label: '朋友' },
  { value: 'private', label: '僅自己' },
];

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const postId = parseInt(id ?? '0');

  const [postText, setPostText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadPost() {
      if (!currentUser || !postId) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/post/${postId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) {
          setPostText(data.data.post_text ?? '');
          setVisibility(data.data.visibility ?? 'public');
          const rawTags = data.data.tags;
          if (Array.isArray(rawTags)) {
            setTags(rawTags.map((t: string | { tag_name: string }) =>
              typeof t === 'string' ? t : t.tag_name
            ));
          }
        } else {
          Alert.alert('錯誤', '無法載入貼文');
          router.back();
        }
      } catch {
        Alert.alert('錯誤', '網路連線失敗');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [postId, currentUser]);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!postText.trim()) {
      Alert.alert('提醒', '請輸入貼文內容');
      return;
    }
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/post/${postId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_text: postText.trim(),
          visibility,
          ...(tags.length > 0 ? { tags } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        Alert.alert('成功', '貼文已更新！', [{ text: '確定', onPress: () => router.replace('/community') }]);
      } else {
        Alert.alert('錯誤', data.error ?? '更新失敗，請稍後再試');
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground source={require('../../../assets/backgrounds/main.mp4')}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>編輯貼文</Text>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.submitBtnText}>儲存</Text>
              }
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Content */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>貼文內容</Text>
          <TextInput
            style={styles.textArea}
            value={postText}
            onChangeText={setPostText}
            placeholder="在這裡輸入你的分享..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            textAlignVertical="top"
          />
        </GlassCard>

        {/* Visibility */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>誰可以看見</Text>
          <View style={styles.optionRow}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, visibility === opt.value && styles.optionBtnActive]}
                onPress={() => setVisibility(opt.value)}
              >
                <Text style={[styles.optionText, visibility === opt.value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Tags */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>標籤</Text>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <TouchableOpacity key={i} style={styles.tag} onPress={() => handleRemoveTag(tag)}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <Text style={styles.tagRemove}> ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="輸入標籤後按新增"
              placeholderTextColor="rgba(255,255,255,0.4)"
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
              <Text style={styles.addTagBtnText}>新增</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </ScrollView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCard: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelText: { fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.95)' },
  submitBtn: {
    backgroundColor: 'rgba(0,122,255,0.7)',
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 56, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  card: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 10 },
  textArea: { minHeight: 160, fontSize: 16, color: 'rgba(255,255,255,0.95)', lineHeight: 24 },
  input: {
    height: 44, fontSize: 15, color: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.25)', paddingVertical: 4,
  },
  optionRow: { flexDirection: 'row', gap: 10 },
  optionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionBtnActive: { backgroundColor: 'rgba(0,122,255,0.5)', borderColor: 'rgba(0,122,255,0.7)' },
  optionText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  optionTextActive: { color: '#FFF', fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  tag: {
    flexDirection: 'row', backgroundColor: 'rgba(0,122,255,0.4)',
    borderRadius: 14, paddingVertical: 5, paddingHorizontal: 12,
    marginRight: 8, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tagText: { color: '#FFF', fontSize: 13 },
  tagRemove: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addTagBtn: {
    backgroundColor: 'rgba(0,122,255,0.5)', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  addTagBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
