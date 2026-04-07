import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth } from '../../lib/firebase';

const getToday = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function CreateDiaryScreen() {
  const router = useRouter();
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();

  // 若從日曆帶入日期參數則使用，否則預設今天
  const [diary_date, setDiaryDate] = useState(paramDate ?? getToday());
  const [diary_title, setDiaryTitle] = useState('');
  const [diary_content, setDiaryContent] = useState('');
  const [bible_quote, setBibleQuote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 新增標籤
  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  // 移除標籤
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 儲存日記
  const handleSave = async () => {
    if (!diary_title.trim()) {
      Alert.alert('錯誤', '請輸入標題');
      return;
    }
    if (!diary_content.trim()) {
      Alert.alert('錯誤', '請輸入內容');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('錯誤', '請先登入');
        return;
      }

      // ✅ 建議強制刷新，避免 token 過期造成驗證失敗
      const idToken = await user.getIdToken(true);

      // ⚠️ Expo 在手機/模擬器時 localhost 指的是「手機自己」
      // 如果你是用手機測，要把 localhost 改成你電腦的 IP，例如 http://192.168.1.10:3000
      const response = await fetch('http://localhost:3000/api/diary', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diary_date, // ✅ 直接用 state
          diary_title: diary_title.trim(),
          diary_content: diary_content.trim(),
          bible_quote: bible_quote.trim() || null,
          tags: tags.length > 0 ? tags : null,
          collectId: null, // 目前沒有收藏功能，先傳 null
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        Alert.alert('成功', '日記已儲存', [
          { text: '確定', onPress: () => router.back() },
        ]);

        // ✅ 儲存成功後清空表單（如果不直接返回上一頁的話）
        setDiaryTitle('');
        setDiaryContent('');
        setBibleQuote('');
        setTags([]);

      } else {
        Alert.alert('錯誤', data?.error ?? '儲存失敗');
      }
    } catch (error) {
      console.error('儲存失敗:', error);
      Alert.alert('錯誤', '儲存失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* 日期 */}
        <View style={styles.section}>
          <Text style={styles.label}>日期</Text>
          <TextInput
            style={styles.input}
            value={diary_date}
            onChangeText={setDiaryDate}
            placeholder="YYYY-MM-DD" 
          />
        </View>

        {/* 標題 */}
        <View style={styles.section}>
          <Text style={styles.label}>標題 *</Text>
          <TextInput
            style={styles.input}
            value={diary_title}
            onChangeText={setDiaryTitle}
            placeholder="輸入標題"
          />
        </View>

        {/* 經文 */}
        <View style={styles.section}>
          <Text style={styles.label}>靈感金句</Text>
          <TextInput
            style={styles.input}
            value={bible_quote}
            onChangeText={setBibleQuote}
            placeholder="「求祢指教我們怎樣數算自己的日子，好叫我們得著智慧的心。」（詩 90:12）"
            multiline
          />
        </View>

        {/* 內容 */}
        <View style={styles.section}>
          <Text style={styles.label}>內容 *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={diary_content}
            onChangeText={setDiaryContent}
            placeholder="今天發生了什麼......？"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* 標籤 */}
        <View style={styles.section}>
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

          <View style={styles.tagInputContainer}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="輸入標籤"
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.addTagButton}
              onPress={handleAddTag}
            >
              <Text style={styles.addTagButtonText}>新增</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 儲存按鈕 */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>儲存</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 20 },
  section: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  textArea: { height: 150, textAlignVertical: 'top' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  tag: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: '#FFF', fontSize: 14 },
  tagRemove: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  tagInputContainer: { flexDirection: 'row', gap: 10 },
  addTagButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addTagButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: { backgroundColor: '#CCC' },
  saveButtonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});