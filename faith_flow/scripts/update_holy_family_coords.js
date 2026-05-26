const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  const col = db.collection('basilicas');
  const snap = await col.where('viewerUrl', '==', 'taipei_holy_family').get();

  if (snap.empty) {
    console.log('❌ 找不到 taipei_holy_family');
    process.exit(1);
  }

  const doc = snap.docs[0];
  await doc.ref.update({
    coordinates: [25.0288171, 121.5339982],
  });

  console.log(`✅ 已更新台北聖家堂座標: [25.0288171, 121.5339982]`);
  console.log(`   文件 ID: ${doc.id}`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});
