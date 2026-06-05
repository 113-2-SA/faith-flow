// ==================== config/firebase.js ====================
const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  // 線上環境：從環境變數讀 JSON 內容
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // 本機環境：從檔案路徑讀
  const fs = require("fs");
  const path = require("path");
  const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (!require("fs").existsSync(serviceAccountPath)) {
    console.error("❌ Firebase 服務帳號檔案不存在:", serviceAccountPath);
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
} else {
  console.error("❌ 缺少 Firebase 設定：需要 FIREBASE_SERVICE_ACCOUNT_JSON 或 FIREBASE_SERVICE_ACCOUNT_PATH");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

console.log("✅ Firebase Admin SDK 已初始化");

module.exports = admin;