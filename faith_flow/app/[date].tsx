import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { VideoBackground } from "../components/VideoBackground";
import { GlassCard } from "../components/GlassCard";

export default function DiaryEntry() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');

  const handleSave = () => {
    // 這裡通常會串接 API 或 Local Storage 儲存資料
    console.log('Saving diary:', { date, title, content });
    Alert.alert("儲存成功", "你的靈魂日誌已記錄。");
    router.replace('/home');
  };

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: `${date} 日記`,
        headerTransparent: true,
        headerTintColor: '#fff',
      }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 100 }}>
        <GlassCard style={{ padding: 20 }}>
          {step === 'edit' ? (
            <View>
              <Text style={styles.label}>日記標題</Text>
              <TextInput
                style={styles.input}
                placeholder="為今天寫個標題..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>日記內容</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="寫下你的心情或祈禱..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
              />

              <TouchableOpacity 
                style={styles.button} 
                onPress={() => setStep('confirm')}
              >
                <Text style={styles.buttonText}>下一步：預覽確認</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.confirmHeader}>確認你的日記</Text>
              
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>日期：{date}</Text>
                <Text style={styles.previewTitle}>{title || "(無標題)"}</Text>
                <View style={styles.divider} />
                <Text style={styles.previewContent}>{content || "(無內容)"}</Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton]} 
                  onPress={() => setStep('edit')}
                >
                  <Text style={styles.buttonText}>返回編輯</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.button} 
                  onPress={handleSave}
                >
                  <Text style={styles.buttonText}>確認儲存</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  label: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    minHeight: 180,
  },
  button: {
    backgroundColor: '#c8922a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
  },
  confirmHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewBox: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 },
  previewTitle: { color: '#f5d680', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  previewContent: { color: '#fff', fontSize: 16, lineHeight: 24 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 12 }
});