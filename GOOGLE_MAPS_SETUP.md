# Google Maps API 配置指南

## 概述
朝聖之地現已改為使用 Google Maps API，支援 Web、iOS 和 Android 平台。

## 配置步驟

### 1. 取得 Google Maps API Key

1. 訪問 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新項目或選擇現有項目
3. 啟用以下 API：
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Maps JavaScript API**
4. 建立 API 金鑰：
   - 導航至 **Credentials** → **Create Credentials** → **API Key**
   - 複製生成的 API 密鑰

### 2. 配置環境變數

編輯 `.env.local` 文件，替換 API Key：

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_ACTUAL_API_KEY_HERE"
```

### 3. 限制 API Key（可選但推薦）

在 Google Cloud Console 中設置 API Key 限制：

#### Android 應用限制
- 選擇 **API key restriction** → **Android apps**
- 新增您的應用包名：`com.fjuim43.ff`
- 新增 SHA-1 指紋

可使用以下命令取得 SHA-1 指紋：
```bash
keytool -list -v -keystore ~/.android/debug.keystore
```

#### iOS 應用限制
- 選擇 **API key restriction** → **iOS apps**
- 新增您的 Bundle ID：`com.fjuim43.ff`

#### Web 限制
- 選擇 **API key restriction** → **HTTP referrers**
- 新增您的網站域名

### 4. 功能說明

#### Native 版本 (iOS/Android)
- 使用 `react-native-maps` 搭配 Google Maps Provider
- 支援標記、拖動、縮放等功能
- 由 `BasilicaMap.native.tsx` 負責

#### Web 版本
- 使用 `@react-google-maps/api` 庫
- 支援互動式地圖和資訊視窗
- 由 `GoogleMapsComponent.web.tsx` 負責
- 透過 `BasilicaMap.web.tsx` 整合

### 5. 檔案結構

```
faith_flow/
├── components/
│   ├── BasilicaMap.native.tsx    # Native 地圖元件
│   ├── BasilicaMap.web.tsx       # Web 包裝元件
│   └── GoogleMapsComponent.web.tsx # Web Google Maps 實現
├── config/
│   └── mapConfig.ts              # 地圖配置檔案
├── .env.local                     # 環境變數
└── app.json                       # Expo 配置
```

### 6. 配置文件參考

**config/mapConfig.ts:**
```typescript
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
export const MAP_CONFIG = {
  apiKey: GOOGLE_MAPS_API_KEY,
  defaultCenter: { lat: 41.9029, lng: 12.4534 },
  defaultZoom: 4,
  libraries: ["places", "marker"],
};
```

**app.json iOS 配置:**
```json
"ios": {
  "config": {
    "googleMapsApiKey": "$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
  }
}
```

**app.json Android 配置:**
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
    }
  }
}
```

## 常見問題

### Q: 地圖顯示空白？
A: 確認 API Key 正確配置在 `.env.local` 中，且 API 在 Google Cloud Console 中已啟用。

### Q: Native 版本無法顯示地圖？
A: 確保 `PROVIDER_GOOGLE` 已在 `BasilicaMap.native.tsx` 中正確匯入和使用。

### Q: Web 版本地圖未載入？
A: 檢查瀏覽器控制台的錯誤訊息，確認 API Key 有效且網站域名已列入限制。

## 依賴套件

- `react-native-maps@1.20.1` - Native 地圖支持
- `@react-google-maps/api` - Web Google Maps 支持
- `expo@~54.0.32` - Expo 框架

## 測試

### Native 測試
```bash
npm run ios    # iOS 模擬器
npm run android # Android 模擬器
```

### Web 測試
```bash
npm run web
```

## 重要提醒

⚠️ **不要在版本控制中提交 `.env.local` 文件**，該文件包含敏感的 API Key。確保將其新增到 `.gitignore`。

```gitignore
.env.local
.env.*.local
```
