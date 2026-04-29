/**
 * updateChurchHeadings.js
 *
 * 管理員腳本：將各教堂的 panoramaHeading（朝向正面方位角）與
 * 優化後的 coordinates 寫入現有 Firestore 文件。
 *
 * 執行方式：
 *   node scripts/updateChurchHeadings.js
 *
 * panoramaHeading 說明：
 *   Street View 初始鏡頭方向（0=北, 90=東, 180=南, 270=西）
 *   設定依據：從教堂入口廣場/前庭朝向建築正面的羅盤方向
 */

require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

// viewerUrl → { coordinates, panoramaHeading } 對照表
const HEADING_UPDATES = {
  stpeter: {
    coordinates: [41.9021, 12.4562], // 聖伯多祿廣場中央
    panoramaHeading: 270,            // 正面朝東，由廣場向西看
  },
  stpaul: {
    coordinates: [41.8589, 12.4769], // 北側廣場
    panoramaHeading: 180,            // 正面朝北，由北廣場向南看
  },
  santa_maria: {
    coordinates: [41.8978, 12.4971], // 西側廣場
    panoramaHeading: 90,             // 主正面朝西，由東側廣場向西看
  },
  san_giovanni: {
    coordinates: [41.8858, 12.5056], // 東側廣場
    panoramaHeading: 270,            // 主正面朝東，由廣場向西看
  },
  assisi: {
    coordinates: [43.0749, 12.6059], // 下方廣場（Piazza Inferiore）
    panoramaHeading: 0,              // 正面朝南，由南側廣場向北看
  },
  santiago: {
    coordinates: [42.5803, -8.5444], // Praza do Obradoiro
    panoramaHeading: 90,             // Obradoiro 正面朝西，由廣場向東看
  },
  reims: {
    coordinates: [49.2534, 4.0334],  // 西側廣場
    panoramaHeading: 90,             // 正面朝西，由西廣場向東看
  },
  chartres: {
    coordinates: [48.4431, 1.4876],  // 西側廣場
    panoramaHeading: 90,             // 正面朝西，由西廣場向東看
  },
  notre_dame: {
    coordinates: [48.8530, 2.3486],  // Parvis Notre-Dame
    panoramaHeading: 90,             // 正面朝西，由 Parvis 向東看
  },
  cologne: {
    coordinates: [50.9413, 6.9572],  // 西側 Domplatte
    panoramaHeading: 110,            // 正面略朝西南，由西北廣場朝東南看
  },
  jingxin: {
    coordinates: [25.0324, 121.4286],
    panoramaHeading: 180,            // 正面朝北，由南側向北看
  },
  holy_sepulchre: {
    coordinates: [31.7784, 35.2296], // 入口前廣場
    panoramaHeading: 0,              // 入口朝南，由南側廣場向北看正面
  },
  nativity: {
    coordinates: [31.7053, 35.2025], // Manger Square
    panoramaHeading: 180,            // 入口朝北，由 Manger Square 向南看
  },
  annunciation: {
    coordinates: [32.7034, 35.2968], // 北側廣場
    panoramaHeading: 180,            // 正面朝北，由北廣場向南看
  },
  multiplication: {
    coordinates: [32.8771, 35.5694],
    panoramaHeading: 90,             // 正面朝西，由東側入口廣場向西看
  },
  gallicantu: {
    coordinates: [31.7700, 35.2295], // 錫安山坡道
    panoramaHeading: 30,             // 正面朝西北，由東南坡道向西北看
  },
};

async function updateChurchHeadings() {
  console.log('🔄 開始更新教堂方位角與座標...\n');

  const snapshot = await db.collection('basilicas').get();
  if (snapshot.empty) {
    console.log('⚠️  Firestore 中無教堂資料，請先執行 uploadBasilicas.js');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const update = HEADING_UPDATES[data.viewerUrl];

    if (!update) {
      console.log(`⏭️  ${data.name} — viewerUrl "${data.viewerUrl}" 無對應設定，略過`);
      skipped++;
      continue;
    }

    await doc.ref.update({
      coordinates: update.coordinates,
      panoramaHeading: update.panoramaHeading,
    });

    console.log(`✅ ${data.name}`);
    console.log(`   coordinates: [${update.coordinates}]`);
    console.log(`   panoramaHeading: ${update.panoramaHeading}°`);
    updated++;
  }

  console.log(`\n完成！已更新: ${updated}  略過: ${skipped}`);
  console.log('📌 請重新執行 fetchChurchPanoramas.js 讓 streetViewUrl 套用新方位角。');
}

updateChurchHeadings().catch(console.error);
