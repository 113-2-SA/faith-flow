import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView,
  StyleSheet, Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native';
import { GlassCard } from '../../components/GlassCard';
import { VideoBackground } from '../../components/VideoBackground';
import { API_BASE_URL } from '../../lib/api';
import { useAuth } from '../context/authcontext';

type Visibility = 'public' | 'group' | 'private';

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: '公開' },
  { value: 'private', label: '僅自己' },
];

interface DiaryItem {
  diary_id: number;
  diary_date: string;
  diary_title: string;
  diary_content: string;
}

interface SummaryItem {
  summary_id: number;
  year: number;
  week_number: number;
  summary_title: string;
  summary_content: string;
  bible_quote: string | null;
  start_date: string;
  end_date: string;
}

// ✨ 新增：信箋資料的型別定義
interface LetterItem {
  letter_id: number;
  summary_text: string;      // 信箋摘要內容
  question?: string;         // 問題主題（從 ai_questions 來）
  image_url?: string;        // 卡片圖片（Cloudflare R2）
  quote?: string;        // ✨ 改這裡（原本是 letter_quote）
  quote_source?: string; // 金句來源
  }

export default function CreatePostScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // ✨ 新增 letter_id 到路由參數解析
  const params = useLocalSearchParams<{
    diary_id?: string;
    summary_year?: string;
    summary_week?: string;
    letter_id?: string;      // 新增：從 collection.tsx 帶過來
  }>();

  const [postText, setPostText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  // 日記附件（從路由參數帶入）
  const [attachedDiary, setAttachedDiary] = useState<DiaryItem | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);

  // 周回顧附件（從路由參數帶入）
  const [attachedSummary, setAttachedSummary] = useState<SummaryItem | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ✨ 新增：信箋附件的 state
  const [attachedLetter, setAttachedLetter] = useState<LetterItem | null>(null);
  const [letterLoading, setLetterLoading] = useState(false);

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  // 若有 summary_year + summary_week 參數，自動抓取周回顧資料
  useEffect(() => {
    if (!params.summary_year || !params.summary_week || !currentUser) return;
    const loadSummary = async () => {
      setSummaryLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(
          `${API_BASE_URL}/api/weekly-summary/${params.summary_year}/${params.summary_week}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.ok) {
          const s = data.data;
          setAttachedSummary({
            summary_id:      s.summaryID ?? s.summary_id,
            year:            s.year,
            week_number:     s.week_number,
            summary_title:   s.summary_title,
            summary_content: s.summary_content,
            bible_quote:     s.bible_quote ?? null,
            start_date:      s.start_date,
            end_date:        s.end_date,
          });
        } else {
          Alert.alert('提醒', '無法載入周回顧，請重新嘗試');
        }
      } catch {
        Alert.alert('錯誤', '網路連線失敗');
      } finally {
        setSummaryLoading(false);
      }
    };
    loadSummary();
  }, [params.summary_year, params.summary_week, currentUser]);

  // 若有 diary_id 參數，自動抓取日記資料
  useEffect(() => {
    if (!params.diary_id || !currentUser) return;
    const loadDiary = async () => {
      setDiaryLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/diary/${params.diary_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) {
          const d = data.data;
          setAttachedDiary({
            diary_id: d.diary_id,
            diary_date: d.diary_date,
            diary_title: d.diary_title,
            diary_content: d.diary_content,
          });
        } else {
          Alert.alert('提醒', '無法載入日記，請重新嘗試');
        }
      } catch {
        Alert.alert('錯誤', '網路連線失敗');
      } finally {
        setDiaryLoading(false);
      }
    };
    loadDiary();
  }, [params.diary_id, currentUser]);

  // ✨ 新增：若有 letter_id 參數，自動抓取信箋資料
  // 📌 為什麼要呼叫 API 而不是直接用 params 傳資料？
  //    因為照著日記的模式，統一從後端抓，資料更完整也更安全
  useEffect(() => {
    if (!params.letter_id || !currentUser) return;
    const loadLetter = async () => {
      setLetterLoading(true);
      try {
        const token = await currentUser.getIdToken();
        // 呼叫交接文件中已存在的 API：GET /api/livingwater/letter/:letter_id
        const res = await fetch(
          `${API_BASE_URL}/api/livingwater/letter/${params.letter_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.success) {
          const l = data.data;
          setAttachedLetter({
            letter_id:           l.letter_id,
            summary_text:        l.summary_text,
            question:            l.question ?? '',
            image_url:           l.image_url ?? null,
            quote:        l.quote ?? null,        // ✨ 改這裡
            quote_source: l.quote_source ?? null, // ✨ 改這裡
        });
        } else {
          Alert.alert('提醒', '無法載入信箋，請重新嘗試');
        }
      } catch {
        Alert.alert('錯誤', '網路連線失敗');
      } finally {
        setLetterLoading(false);
      }
    };
    loadLetter();
  }, [params.letter_id, currentUser]);

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
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        Alert.alert('圖片太大', `圖片大小不能超過 5MB（目前約 ${(asset.fileSize / 1024 / 1024).toFixed(1)} MB），請選擇較小的圖片。`);
        return;
      }
      setImageUri(asset.uri);
      setImageMime(asset.mimeType ?? 'image/jpeg');
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
    // ✨ 修改：有信箋附件時 postText 也可以留空
    if (!attachedDiary && !attachedSummary && !attachedLetter && !postText.trim()) {
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

      // ✨ 修改：post_type 加入 'letter' 判斷
      // 📌 優先順序：letter > diary > summary > normal
      const postType = attachedLetter ? 'letter'
        : attachedDiary ? 'diary'
        : attachedSummary ? 'summary'
        : 'normal';

      let body: string | FormData;
      let headers: Record<string, string> = { Authorization: `Bearer ${token}` };

      if (imageUri) {
        const formData = new FormData();
        formData.append('post_text', postText.trim());
        formData.append('post_type', postType);
        formData.append('visibility', visibility);
        if (tags.length > 0) formData.append('tags', JSON.stringify(tags));
        if (attachedDiary) formData.append('diary_id', String(attachedDiary.diary_id));
        if (attachedSummary) formData.append('summary_id', String(attachedSummary.summary_id));
        // ✨ 新增：信箋 id 加入 FormData
        if (attachedLetter) formData.append('letter_id', String(attachedLetter.letter_id));
        const filename = imageUri.split('/').pop() ?? 'photo.jpg';
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('post_pic', blob, filename);
        } else {
          (formData as any).append('post_pic', {
            uri: imageUri,
            name: filename,
            type: imageMime,
          });
        }
        body = formData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          post_text: postText.trim(),
          post_type: postType,
          visibility,
          ...(tags.length > 0 ? { tags } : {}),
          ...(attachedDiary ? { diary_id: attachedDiary.diary_id } : {}),
          ...(attachedSummary ? { summary_id: attachedSummary.summary_id } : {}),
          // ✨ 新增：信箋 id 加入 JSON body
          ...(attachedLetter ? { letter_id: attachedLetter.letter_id } : {}),
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

        {/* ✨ 新增：信箋預覽卡片（照著日記的 UI 模式） */}
        {letterLoading ? (
          <GlassCard style={styles.card}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" />
            <Text style={styles.label}>載入信箋中...</Text>
          </GlassCard>
        ) : attachedLetter ? (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>引用的信箋</Text>
            <View style={styles.attachedLetterCard}>
              {/* 左圖右文，和 letter.tsx / collection.tsx 的版面一致 */}
              <View style={styles.letterPreviewRow}>
                {attachedLetter.image_url ? (
                  <Image
                    source={{ uri: attachedLetter.image_url }}
                    style={styles.letterPreviewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.letterPreviewImagePlaceholder}>
                    <Text style={{ fontSize: 24 }}>🖼️</Text>
                  </View>
                )}
                <View style={styles.letterPreviewText}>
                  {/* 問題標題 */}
                  {attachedLetter.question ? (
                    <Text style={styles.letterQuestion} numberOfLines={2}>
                      {attachedLetter.question}
                    </Text>
                  ) : null}
                  {/* 摘要前60字預覽 */}
                  <Text style={styles.diaryPreview} numberOfLines={3}>
                    {attachedLetter.summary_text.slice(0, 80)}
                    {attachedLetter.summary_text.length > 80 ? '...' : ''}
                  </Text>
                  {/* 金句 */}
                  {attachedLetter.quote ? (
  <Text style={styles.letterQuote} numberOfLines={2}>
    「{attachedLetter.quote}」
  </Text>
) : null}
                </View>
                {/* 移除按鈕 */}
                <TouchableOpacity
                  onPress={() => setAttachedLetter(null)}
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        ) : null}

        {/* Attached diary card（原有，完全沒動） */}
        {diaryLoading ? (
          <GlassCard style={styles.card}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" />
            <Text style={styles.label}>載入日記中...</Text>
          </GlassCard>
        ) : attachedDiary ? (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>引用的日記</Text>
            <View style={styles.attachedDiaryCard}>
              <View style={styles.attachedDiaryHeader}>
                <Text style={styles.diaryIcon}>📖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diaryDate}>{attachedDiary.diary_date}</Text>
                  <Text style={styles.diaryTitle} numberOfLines={1}>
                    {attachedDiary.diary_title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAttachedDiary(null)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.diaryPreview} numberOfLines={2}>
                {attachedDiary.diary_content.slice(0, 60)}
                {attachedDiary.diary_content.length > 60 ? '...' : ''}
              </Text>
            </View>
          </GlassCard>
        ) : null}

        {/* Attached summary card（原有，完全沒動） */}
        {summaryLoading ? (
          <GlassCard style={styles.card}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" />
            <Text style={styles.label}>載入周回顧中...</Text>
          </GlassCard>
        ) : attachedSummary ? (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>引用的周回顧</Text>
            <View style={styles.attachedSummaryCard}>
              <View style={styles.attachedDiaryHeader}>
                <Text style={styles.diaryIcon}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diaryDate}>
                    {attachedSummary.year} 年 第 {attachedSummary.week_number} 週
                  </Text>
                  <Text style={styles.diaryTitle} numberOfLines={1}>
                    {attachedSummary.summary_title}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAttachedSummary(null)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.diaryPreview} numberOfLines={2}>
                {attachedSummary.summary_content.slice(0, 60)}
                {attachedSummary.summary_content.length > 60 ? '...' : ''}
              </Text>
            </View>
          </GlassCard>
        ) : null}

        {/* Content input */}
        <GlassCard style={styles.card}>
          {/* ✨ 修改：信箋也有「加點想法（選填）」的提示 */}
          <Text style={styles.label}>
            {attachedDiary || attachedLetter ? '加點想法（選填）' : '有什麼想分享的？'}
          </Text>
          <TextInput
            style={styles.textArea}
            value={postText}
            onChangeText={setPostText}
            placeholder={
              attachedLetter ? '為這份信箋加上你的感想...'
              : attachedDiary ? '為這篇日記加上你的感想...'
              : '在這裡輸入你的分享...'
            }
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            textAlignVertical="top"
          />
        </GlassCard>

        {/* Image picker（原有，完全沒動） */}
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

        {/* Visibility（原有，完全沒動） */}
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

        {/* Tags（原有，完全沒動） */}
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

  // 日記卡片樣式（原有）
  attachedDiaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(100,180,255,0.4)',
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(0,80,180,0.15)',
  },
  // 周回顧卡片樣式（原有）
  attachedSummaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(180,140,255,0.4)',
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(80,0,180,0.15)',
  },
  attachedDiaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  diaryIcon: { fontSize: 20 },
  diaryDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
  },
  diaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeBtnText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
  },
  diaryPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },

  // ✨ 新增：信箋卡片樣式（綠色系，和活水泉源主題一致）
  attachedLetterCard: {
    borderWidth: 1,
    borderColor: 'rgba(80,180,120,0.4)',       // 綠色邊框
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(0,80,40,0.25)',      // 深綠背景
  },
  letterPreviewRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  letterPreviewImage: {
    width: 70,
    height: 100,
    borderRadius: 8,
    flexShrink: 0,
  },
  letterPreviewImagePlaceholder: {
    width: 70,
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  letterPreviewText: {
    flex: 1,
    gap: 6,
  },
  letterQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  letterQuote: {
    fontSize: 12,
    color: 'rgba(180,230,180,0.85)',            // 淡綠色金句
    fontStyle: 'italic',
    lineHeight: 17,
  },
});