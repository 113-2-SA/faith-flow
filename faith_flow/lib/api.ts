import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (!__DEV__) {
    return 'https://your-production-api.com';
  }

  // Web 瀏覽器直接用 localhost（和後端同機器）
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // 手機透過熱點連筆電：從 Expo DevServer hostUri 取得筆電 IP
  const debuggerHost = Constants.expoConfig?.hostUri;
  const laptopIp = debuggerHost?.split(':')[0];
  if (laptopIp) {
    return `http://${laptopIp}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL =', API_BASE_URL);