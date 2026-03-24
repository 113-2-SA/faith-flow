// app/context/preferencesContext.tsx
// 管理使用者偏好設定，用 AsyncStorage 本地儲存
// 之後 DB 建好後只需改這個檔案的 load/save 函式

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'user_preferences';

export interface Preferences {
  // 通知開關
  communityNotifications: boolean; // 社群通知（阿們/留言/引用）
  diaryReminder: boolean;          // 日記提醒
  cardReminder: boolean;           // 抽卡提醒
  // 隱私
  publicCollection: boolean;       // 收藏公開
  // 音效
  bgMusicVolume: number;           // 背景音樂音量 0~100
}

const DEFAULT_PREFERENCES: Preferences = {
  communityNotifications: true,
  diaryReminder: true,
  cardReminder: true,
  publicCollection: false,
  bgMusicVolume: 50,
};

interface PreferencesContextType {
  preferences: Preferences;
  loading: boolean;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
  resetPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  // 載入儲存的偏好
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
        }
      } catch (e) {
        console.error('[Preferences] load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 更新單一偏好
  const updatePreference = async <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[Preferences] save failed:', e);
    }
  };

  // 重置為預設值
  const resetPreferences = async () => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('[Preferences] reset failed:', e);
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreference, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}
