const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const NEW_CHURCH = {
  name: '台北聖若望鮑思高天主堂',
  nameEn: 'St. John Bosco Parish Taipei',
  coordinates: [25.0580496, 121.5471302],
  location: '台灣、台北市中正區',
  type: 'chapel',
  founded: 1952,
  dedication: '聖若望鮑思高',
  style: '現代教堂建築',
  significance: '慈幼會（鮑思高神父會）在台北的信仰中心，以青年教育與牧靈服務著稱，延續鮑思高神父「給我靈魂，其他都拿去」的福傳精神，見證慈幼會在台灣的教育與傳教使命',
  description: '台北聖若望鮑思高天主堂由慈幼會（Salesians of Don Bosco）創立，以聖若望鮑思高（Don Bosco，1815-1888）為主保。鮑思高神父是義大利神父，一生致力於貧困青少年的教育與靈魂牧養，創立慈幼會，並於1934年被封為聖人。教堂承繼其精神，結合學校教育與宗教培育，是台北南區天主教信仰與青年服務的重要據點，也是信徒靈修與聚會的精神家園。',
  viewerUrl: 'taipei_st_john_bosco',
  panoramaId: null,
  videoUrl: null,
};

async function run() {
  const col = db.collection('basilicas');

  const snap = await col.get();
  const existingViewerUrls = new Set(snap.docs.map(d => d.data().viewerUrl).filter(Boolean));

  console.log(`📦 Firestore 目前共有 ${snap.size} 筆教堂資料`);

  if (existingViewerUrls.has(NEW_CHURCH.viewerUrl)) {
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
