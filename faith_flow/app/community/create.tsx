import { useState } from 'react';
import { Platform } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';

type Visibility = 'public' | 'group' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: '公開' },
  { value: 'group', label: '朋友' },
  { value: 'private', label: '僅自己' },
];

// ⭐⭐⭐ 根據平台動態設定 API URL ⭐⭐⭐
const getApiUrl = () => {
  if (!__DEV__) {
    // 生產環境
    return 'https://your-production-api.com';
  }

  // 開發環境
  if (Platform.OS === 'android') {
    // Android 模擬器：10.0.2.2 指向電腦的 localhost
    return 'http://10.0.2.2:3000';
  } else if (Platform.OS === 'ios') {
    // iOS 模擬器：可以使用 localhost
    return 'http://localhost:3000';
  } else if (Platform.OS === 'web') {
    // Web 環境：使用 localhost
    return 'http://localhost:3000';
  }

  // 實體裝置
  return 'http://192.168.1.100:3000'; // 請替換成你的電腦 IP 位址(未更改)
};

const API_BASE_URL = getApiUrl();

export default function CreatePostScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [postText, setPostText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '請允許存取相片庫');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

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
    if (!currentUser) {
      Alert.alert('錯誤', '請先登入');
      return;
    }

    setLoading(true);
    try {
      const token = await currentUser.getIdToken(true);

      let body: string | FormData;
      let headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      if (imageUri) {
        // 有圖片 → 用 FormData（multipart）
        const formData = new FormData();
        formData.append('post_text', postText.trim());
        formData.append('post_type', 'normal');
        formData.append('visibility', visibility);
        if (tags.length > 0) formData.append('tags', JSON.stringify(tags));
        const filename = imageUri.split('/').pop() ?? 'photo.jpg';
        if (Platform.OS === 'web') {
          // Web：需要先 fetch 成 Blob 才能附加到 FormData
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('post_pic', blob, filename);
        } else {
          // React Native（iOS / Android）
          (formData as any).append('post_pic', {
            uri: imageUri,
            name: filename,
            type: imageMime,
          });
        }
        body = formData;
        // 不設 Content-Type，讓 fetch 自動帶 boundary
      } else {
        // 沒有圖片 → 用 JSON（原本的行為）
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          post_text: postText.trim(),
          post_type: 'normal',
          visibility,
          ...(tags.length > 0 ? { tags } : {}),
        });
      }

      const res = await fetch(`${API_BASE_URL}/api/post`, {
        method: 'POST',
        headers,
        body,
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        router.replace('/community');
      } else {
        const msg = data.error ?? (data.errors?.[0]?.msg) ?? '發布失敗，請稍後再試';
        Alert.alert('錯誤', msg);
      }
    } catch (err: any) {
      Alert.alert('錯誤', err?.message ?? '網路連線失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>新增貼文</Text>
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>發布</Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Content input */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>有什麼想分享的？</Text>
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

        {/* Image picker */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>新增圖片（選填）</Text>
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                <Text style={styles.removeImageText}>移除圖片</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickImage}>
              <Text style={styles.pickImageText}>＋ 從相片庫選取</Text>
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* Visibility */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>誰可以看見</Text>
          <View style={styles.optionRow}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionBtn,
                  visibility === opt.value && styles.optionBtnActive,
                ]}
                onPress={() => setVisibility(opt.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    visibility === opt.value && styles.optionTextActive,
                  ]}
                >
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
                <TouchableOpacity
                  key={i}
                  style={styles.tag}
                  onPress={() => handleRemoveTag(tag)}
                >
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
  headerCard: { marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  submitBtn: {
    backgroundColor: 'rgba(0,122,255,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 56,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  card: { marginBottom: 16 },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 160,
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 24,
  },
  input: {
    height: 44,
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.5)',
    borderColor: 'rgba(0,122,255,0.7)',
  },
  optionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  optionTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  tag: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,122,255,0.4)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tagText: { color: '#FFF', fontSize: 13 },
  tagRemove: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addTagBtn: {
    backgroundColor: 'rgba(0,122,255,0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addTagBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pickImageBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickImageText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  removeImageBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeImageText: {
    color: 'rgba(255,100,100,0.9)',
    fontSize: 14,
  },
});
