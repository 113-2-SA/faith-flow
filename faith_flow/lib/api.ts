import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBaseUrl(): string {
  // 優先使用環境變數（Cloudflare tunnel / 生產環境皆適用，手機不需同網段）
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (!__DEV__) {
    return 'https://your-production-api.com';
  }

  // Dev fallback：自動從 Expo DevServer 取得本機 IP
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];

  if (localhost) {
    return `http://${localhost}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL =', API_BASE_URL);