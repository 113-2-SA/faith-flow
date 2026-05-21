const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('basilicas')
    .where('viewerUrl', '==', 'kaohsiung_rosary')
    .get();

  if (snap.empty) {
    console.log('❌ 找不到 kaohsiung_rosary');
    process.exit(1);
  }

  for (const doc of snap.docs) {
    await doc.ref.update({ coordinates: [22.6203245, 120.2916188] });
    console.log(`✅ Firestore 座標已更新: ${doc.data().name}`);
    console.log(`   舊座標: ${JSON.stringify(doc.data().coordinates)}`);
    console.log(`   新座標: [22.6203245, 120.2916188]`);
  }

  process.exit(0);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
