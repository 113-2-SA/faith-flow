// ==================== config/firebase.js ====================
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Firebase 服務帳號檔案不存在:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

console.log("✅ Firebase Admin SDK 已初始化");

module.exports = admin;