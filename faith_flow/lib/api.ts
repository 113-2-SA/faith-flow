import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  if (!__DEV__) {
    return 'https://your-production-api.com'; // 上線時替換成正式網址
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000'; // Android 模擬器
  }
  // iOS 模擬器 / Web
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();
