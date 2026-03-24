// app/settings/index.tsx
// A2 偏好設定頁面
// 儲存在 AsyncStorage，之後 DB 接好再換

import React from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { usePreferences } from '../context/preferencesContext';

export default function SettingsScreen() {
  const { preferences, loading, updatePreference, resetPreferences } = usePreferences();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>載入設定中...</Text>
      </View>
    );
  }

  const handleReset = () => {
    Alert.alert('重置設定', '確定要將所有設定恢復為預設值？', [
      { text: '取消', style: 'cancel' },
      { text: '確定', style: 'destructive', onPress: resetPreferences },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>⚙️ 偏好設定</Text>

      {/* ── 通知設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 通知設定</Text>

        <SettingRow
          label="社群通知"
          description="阿們、留言、引用等社群互動通知"
          value={preferences.communityNotifications}
          onValueChange={(v) => updatePreference('communityNotifications', v)}
        />

        <SettingRow
          label="日記提醒"
          description="每日日記撰寫提醒"
          value={preferences.diaryReminder}
          onValueChange={(v) => updatePreference('diaryReminder', v)}
        />

        <SettingRow
          label="抽卡提醒"
          description="每日抽卡可用時提醒"
          value={preferences.cardReminder}
          onValueChange={(v) => updatePreference('cardReminder', v)}
        />
      </View>

      {/* ── 隱私設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 隱私設定</Text>

        <SettingRow
          label="收藏公開"
          description="允許其他用戶查看你的收藏"
          value={preferences.publicCollection}
          onValueChange={(v) => updatePreference('publicCollection', v)}
        />
      </View>

      {/* ── 音效設定 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎵 音效設定</Text>

        <View style={styles.sliderRow}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.settingLabel}>背景音樂音量</Text>
            <Text style={styles.sliderValue}>{Math.round(preferences.bgMusicVolume)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={preferences.bgMusicVolume}
            onValueChange={(v) => updatePreference('bgMusicVolume', Math.round(v))}
            minimumTrackTintColor="#8B4513"
            maximumTrackTintColor="#DDD"
            thumbTintColor="#8B4513"
          />
        </View>
      </View>

      {/* ── 重置按鈕 ── */}
      <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetBtnText}>重置為預設值</Text>
      </TouchableOpacity>

      <Text style={styles.note}>* 設定儲存於本機，重新安裝 App 後將重置</Text>
    </ScrollView>
  );
}

// ─── 設定列元件 ───────────────────────────────────────────────────────────
function SettingRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#DDD', true: '#8B4513' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', fontSize: 15 },

  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 24 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#8B4513', marginBottom: 12 },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  settingDesc: { fontSize: 12, color: '#888', marginTop: 2 },

  sliderRow: { paddingVertical: 8 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderValue: { fontSize: 14, color: '#8B4513', fontWeight: 'bold' },
  slider: { width: '100%', height: 40 },

  resetBtn: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  resetBtnText: { color: '#CC0000', fontWeight: 'bold', fontSize: 15 },

  note: { color: '#AAA', fontSize: 12, textAlign: 'center' },
});
