/**
 * fetchChurchPanoramas.js
 *
 * 管理員腳本：為每座教堂查詢 Google Street View Metadata API，
 * 取得全景照片的 panoramaId，並將結果寫回 Firestore。
 *
 * 執行方式：
 *   node scripts/fetchChurchPanoramas.js
 *
 * 前置條件：
 *   1. .env 中設定 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 *   2. 該 API Key 已在 Google Cloud Console 開啟 Street View Static API
 */

require("dotenv").config();
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json");

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();
const MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!MAPS_API_KEY || MAPS_API_KEY === "your_google_maps_api_key_here") {
  console.error("❌ 請先在 .env 設定 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

/**
 * 呼叫 Street View Metadata API，優先室內再 fallback 室外。
 *
 * 策略：
 *  1. 小半徑（20m）+ source=default → 優先捕捉教堂入口/室內全景
 *  2. 若無結果，擴大至 80m + source=default → 仍包含室內
 *  3. 若仍無結果，fallback 100m + source=outdoor → 抓周邊街景
 *
 * Metadata API 免費，不計費。
 */
async function fetchStreetViewMetadata(lat, lng) {
  const base =
    `https://maps.googleapis.com/maps/api/streetview/metadata` +
    `?location=${lat},${lng}&key=${MAPS_API_KEY}`;

  // 1. 室內優先：極小半徑
  let res = await fetch(`${base}&radius=20&source=default`);
  let data = await res.json();
  if (data.status === "OK") return { ...data, panoramaSource: "indoor_near" };

  // 2. 稍大半徑，仍含室內
  res = await fetch(`${base}&radius=80&source=default`);
  data = await res.json();
  if (data.status === "OK") return { ...data, panoramaSource: "default_80m" };

  // 3. 最後 fallback：純室外街景
  res = await fetch(`${base}&radius=100&source=outdoor`);
  data = await res.json();
  return { ...data, panoramaSource: "outdoor_100m" };
}

/**
 * 主流程：讀取所有教堂 → 查詢全景 ID → 更新 Firestore
 */
async function fetchChurchPanoramas() {
  console.log("🔍 開始查詢教堂全景資料...\n");

  const snapshot = await db.collection("basilicas").get();
  if (snapshot.empty) {
    console.log("⚠️  Firestore 中無教堂資料，請先執行 uploadBasilicas.js");
    return;
  }

  let success = 0;
  let notFound = 0;

  for (const doc of snapshot.docs) {
    const basilica = doc.data();
    const [lat, lng] = basilica.coordinates;
    const name = basilica.name;

    try {
      const metadata = await fetchStreetViewMetadata(lat, lng);

      let updateData;
      if (metadata.status === "OK" && metadata.pano_id) {
        const panoramaId = metadata.pano_id;
        const isIndoor = metadata.panoramaSource === "indoor_near";
        // 室內全景用較小 fov（90°）展現內部空間感；室外用 90° 標準
        const fov = 90;
        // pitch=10 略微仰角，室內更有身歷其境感
        const pitch = isIndoor ? 10 : 0;

        const streetViewUrl =
          `https://www.google.com/maps/embed/v1/streetview` +
          `?key=${MAPS_API_KEY}&pano=${panoramaId}&heading=0&pitch=${pitch}&fov=${fov}`;

        updateData = {
          panoramaId,
          panoramaStatus: "OK",
          panoramaSource: metadata.panoramaSource,
          streetViewUrl,
          panoramaUpdatedAt: new Date().toISOString(),
        };
        const sourceLabel =
          metadata.panoramaSource === "indoor_near" ? "🏛️  室內/入口" :
          metadata.panoramaSource === "default_80m" ? "🏢 近距含室內" :
          "🌿 室外街景";
        console.log(`✅ ${name}  [${sourceLabel}]`);
        console.log(`   panoramaId: ${panoramaId}`);
        success++;
      } else {
        updateData = {
          panoramaId: null,
          panoramaStatus: metadata.status,
          panoramaSource: null,
          streetViewUrl: null,
          panoramaUpdatedAt: new Date().toISOString(),
        };
        console.log(`⚠️  ${name} — 無全景（${metadata.status}）`);
        notFound++;
      }

      await doc.ref.update(updateData);
    } catch (err) {
      console.error(`❌ ${name} — 查詢失敗:`, err.message);
    }

    // 避免觸發 API 速率限制
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n完成！成功: ${success}  無全景: ${notFound}`);
  console.log("📌 Firestore 中各教堂文件已新增以下欄位：");
  console.log("   panoramaId     — Street View 全景 ID");
  console.log("   panoramaStatus — API 回傳狀態（OK / ZERO_RESULTS …）");
  console.log("   streetViewUrl  — Google Maps Embed 嵌入 URL");
}

fetchChurchPanoramas().catch(console.error);
