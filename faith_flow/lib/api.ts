import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBaseUrl(): string {
  if (!__DEV__) {
    return 'https://your-production-api.com';
  }
  
  // 自動取得 Expo DevServer 的 IP，實體手機也能用
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];
  
  if (localhost) {
    return `http://${localhost}:3000`;
  }
  
  // fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // 模擬器用
  }
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL =', API_BASE_URL);