/**
 * fixChurchCoordinates.js
 *
 * 透過 Google Places API (Text Search) 查詢每座教堂在 Google 地圖上的精確座標，
 * 與 Firestore 現有座標比較，並選擇性地更新。
 *
 * 執行方式：
 *   node scripts/fixChurchCoordinates.js           → 預覽差異（不寫入）
 *   node scripts/fixChurchCoordinates.js --apply   → 確認後寫入 Firestore
 *
 * 前置條件：
 *   1. .env 中設定 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 *   2. 該 API Key 已在 Google Cloud Console 開啟 Places API
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
const APPLY = process.argv.includes("--apply");

if (!MAPS_API_KEY) {
  console.error("❌ 請先在 .env 設定 EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

/**
 * 計算兩點之間的距離（公尺），使用 Haversine 公式。
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 使用 Places Text Search 查詢教堂座標。
 * 傳入英文名稱 + 所在地，提高精確度。
 */
async function fetchPlaceCoordinates(nameEn, location) {
  const query = encodeURIComponent(`${nameEn}, ${location}`);
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${query}&inputtype=textquery&fields=geometry,name,formatted_address&key=${MAPS_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.candidates?.length) {
    // fallback：用 Text Search 再試一次
    const url2 =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${query}&key=${MAPS_API_KEY}`;
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    if (data2.status === "OK" && data2.results?.length) {
      const r = data2.results[0];
      return {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        placeName: r.name,
        address: r.formatted_address,
        source: "textSearch",
      };
    }
    return null;
  }

  const c = data.candidates[0];
  return {
    lat: c.geometry.location.lat,
    lng: c.geometry.location.lng,
    placeName: c.name,
    address: c.formatted_address,
    source: "findPlace",
  };
}

async function main() {
  console.log(APPLY ? "🔧 模式：寫入 Firestore\n" : "🔍 模式：僅預覽（加 --apply 才會寫入）\n");

  const snapshot = await db.collection("basilicas").get();
  if (snapshot.empty) {
    console.log("⚠️  Firestore 中無教堂資料");
    return;
  }

  const results = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const [oldLat, oldLng] = data.coordinates;
    const { name, nameEn, location } = data;

    try {
      const place = await fetchPlaceCoordinates(nameEn, location);

      if (!place) {
        console.log(`⚠️  ${name} — Places API 找不到結果，略過`);
        results.push({ doc, name, skip: true });
        await delay(300);
        continue;
      }

      const dist = Math.round(haversineMeters(oldLat, oldLng, place.lat, place.lng));

      if (dist < 30) {
        console.log(`✅ ${name} — 偏差 ${dist}m，座標準確，無需修正`);
        results.push({ doc, name, skip: true, dist });
      } else {
        console.log(`⚠️  ${name} — 偏差 ${dist}m`);
        console.log(`   現有: [${oldLat}, ${oldLng}]`);
        console.log(`   Google: [${place.lat}, ${place.lng}]`);
        console.log(`   Google 地名: ${place.placeName}`);
        console.log(`   地址: ${place.address}`);
        results.push({
          doc,
          name,
          skip: false,
          dist,
          oldLat,
          oldLng,
          newLat: place.lat,
          newLng: place.lng,
          placeName: place.placeName,
        });
      }
    } catch (err) {
      console.error(`❌ ${name} — 查詢失敗: ${err.message}`);
      results.push({ doc, name, skip: true });
    }

    await delay(300);
  }

  // 統計
  const toUpdate = results.filter((r) => !r.skip);
  console.log(`\n──────────────────────────────`);
  console.log(`共 ${results.length} 座教堂，需修正 ${toUpdate.length} 座`);

  if (toUpdate.length === 0) {
    console.log("所有座標均準確！");
    return;
  }

  if (!APPLY) {
    console.log("\n若要寫入 Firestore，請加上 --apply 重新執行：");
    console.log("  node scripts/fixChurchCoordinates.js --apply");
    return;
  }

  // 寫入
  console.log("\n開始更新 Firestore...");
  let updated = 0;
  for (const r of toUpdate) {
    await r.doc.ref.update({
      coordinates: [r.newLat, r.newLng],
      coordinatesUpdatedAt: new Date().toISOString(),
      coordinatesSource: "google_places_api",
    });
    console.log(`✅ 已更新 ${r.name}: [${r.oldLat}, ${r.oldLng}] → [${r.newLat}, ${r.newLng}]（偏差 ${r.dist}m）`);
    updated++;
  }
  console.log(`\n完成！共更新 ${updated} 座教堂的座標。`);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
