const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const TO_DELETE = [
  'tainan_rosary',
  'taipei_st_joseph',
  'hualien_st_joseph',
  'taichung_sacred_heart',
  'kaohsiung_st_john',
];

const NEW_CHURCH = {
  name: '玫瑰聖母聖殿主教座堂',
  nameEn: 'Cathedral Basilica of Our Lady of the Rosary, Kaohsiung',
  coordinates: [22.62560, 120.30250],
  location: '台灣、高雄市苓雅區',
  type: 'major',
  founded: 1860,
  dedication: '玫瑰聖母',
  style: '哥德式、羅馬式',
  significance: '台灣南部最重要的天主教聖殿，高雄教區主教座堂，兼具聖殿與主教座堂雙重地位，是台灣現存最古老的哥德式天主教建築之一',
  description: '建於1860年，由道明會士創立，是台灣南部歷史最悠久的天主教堂之一。教堂融合哥德式與羅馬式建築風格，外觀宏偉壯麗，以彩色玫瑰窗和精緻的石雕聞名。作為高雄教區的主教座堂，同時享有聖殿（Basilica）封號，是台灣天主教信仰的重要地標，每年吸引大量信徒與旅客前來朝聖。',
  viewerUrl: 'kaohsiung_rosary',
  panoramaId: null,
  videoUrl: null,
};

async function run() {
  const col = db.collection('basilicas');

  // Delete old Taiwan churches
  const snap = await col.get();
  let deleted = 0;
  for (const doc of snap.docs) {
    if (TO_DELETE.includes(doc.data().viewerUrl)) {
      await doc.ref.delete();
      console.log(`🗑️  已刪除: ${doc.data().name}`);
      deleted++;
    }
  }
  console.log(`\n共刪除 ${deleted} 筆舊資料。`);

  // Check if new church already exists
  const existing = snap.docs.find(d => d.data().viewerUrl === NEW_CHURCH.viewerUrl);
  if (existing) {
    console.log(`⏭️  略過（已存在）: ${NEW_CHURCH.name}`);
  } else {
    await col.add(NEW_CHURCH);
    console.log(`✅ 已新增: ${NEW_CHURCH.name}`);
  }

  const finalSnap = await col.get();
  console.log(`\n📊 basilicas collection 目前共有 ${finalSnap.size} 個教堂。`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});
