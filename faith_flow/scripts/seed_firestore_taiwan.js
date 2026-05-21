const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const taiwanChurches = [
  {
    name: '台南玫瑰聖母聖殿主教座堂',
    nameEn: 'Cathedral Basilica of Our Lady of the Rosary',
    coordinates: [22.99960, 120.19910],
    location: '台灣、台南市中西區',
    type: 'major',
    founded: 1636,
    dedication: '玫瑰聖母',
    style: '巴洛克式',
    significance: '台灣天主教信仰的搖籃，道明會在台灣傳教的根據地，見證近四百年信仰傳承，為台灣歷史最悠久的天主教聖殿',
    description: '建於1636年，是台灣歷史最悠久的天主教堂，由西班牙道明會士創立。以玫瑰聖母命名，被列為國定古蹟，保存了台灣天主教早期傳教的珍貴歷史遺跡。現存建築為1929年重建，融合了歐式巴洛克與在地風格，是台南市重要的文化地標。',
    viewerUrl: 'tainan_rosary',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '台北聖若瑟主教座堂',
    nameEn: 'Cathedral of Saint Joseph, Taipei',
    coordinates: [25.06280, 121.51300],
    location: '台灣、台北市大同區',
    type: 'cathedral',
    founded: 1949,
    dedication: '聖若瑟',
    style: '現代教堂建築',
    significance: '台北總教區的主座教堂，台灣天主教行政與禮儀中心，全台最重要的主教座堂之一',
    description: '台北總教區的主教座堂，是台灣北部天主教信仰的中心。教堂建築典雅莊嚴，每逢重要節日舉行盛大禮儀，是台北天主教社群的精神家園，也是主教牧靈工作的核心所在。',
    viewerUrl: 'taipei_st_joseph',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '花蓮聖若瑟主教座堂',
    nameEn: 'Cathedral of Saint Joseph, Hualien',
    coordinates: [23.97690, 121.60130],
    location: '台灣、花蓮縣花蓮市',
    type: 'cathedral',
    founded: 1948,
    dedication: '聖若瑟',
    style: '現代教堂建築',
    significance: '花蓮教區主教座堂，台灣東部天主教信仰中心，見證原住民族與天主教信仰深度結合的歷史',
    description: '花蓮教區的主教座堂，見證了天主教在台灣東部原住民社群中的深厚根基。花蓮教區擁有台灣比例最高的天主教信徒，教堂是信仰社群的凝聚中心，也是台灣後山地區靈修與文化的重要據點。',
    viewerUrl: 'hualien_st_joseph',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '台中聖心主教座堂',
    nameEn: 'Cathedral of the Sacred Heart, Taichung',
    coordinates: [24.14590, 120.67440],
    location: '台灣、台中市西區',
    type: 'cathedral',
    founded: 1950,
    dedication: '耶穌聖心',
    style: '現代教堂建築',
    significance: '台中教區主教座堂，台灣中部天主教信仰與行政中心，見證中台灣的福傳歷史',
    description: '台中教區的主教座堂，以聖心（耶穌聖心）為主保，是台灣中部天主教信仰的核心。教堂建築宏偉，承載著台中地區數十年來的天主教信仰歷史，每年舉行多項重要禮儀活動。',
    viewerUrl: 'taichung_sacred_heart',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '高雄聖若望主教座堂',
    nameEn: 'Cathedral of Saint John, Kaohsiung',
    coordinates: [22.62500, 120.30200],
    location: '台灣、高雄市新興區',
    type: 'cathedral',
    founded: 1955,
    dedication: '聖若望宗徒',
    style: '現代教堂建築',
    significance: '高雄教區主教座堂，南台灣天主教信仰中心，高雄市天主教社群的精神家園',
    description: '高雄教區的主教座堂，以聖若望（聖約翰）為主保，是南台灣天主教信仰的重心。教堂坐落於高雄市中心，長期為高雄地區天主教社群提供靈性滋養與牧靈服務，是南台灣最重要的天主教聖殿之一。',
    viewerUrl: 'kaohsiung_st_john',
    panoramaId: null,
    videoUrl: null,
  },
];

async function seed() {
  const col = db.collection('basilicas');

  // Check existing docs by viewerUrl
  const snap = await col.get();
  const existingViewerUrls = new Set(snap.docs.map(d => d.data().viewerUrl).filter(Boolean));

  console.log(`📦 Firestore 目前共有 ${snap.size} 筆教堂資料`);

  let inserted = 0;
  let skipped = 0;

  for (const church of taiwanChurches) {
    if (existingViewerUrls.has(church.viewerUrl)) {
      console.log(`⏭️  略過（已存在）: ${church.name}`);
      skipped++;
      continue;
    }
    await col.add(church);
    console.log(`✅ 已新增: ${church.name}`);
    inserted++;
  }

  const finalSnap = await col.get();
  console.log(`\n📊 完成！新增 ${inserted} 筆，略過 ${skipped} 筆。`);
  console.log(`📊 basilicas collection 目前共有 ${finalSnap.size} 個教堂。`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});
