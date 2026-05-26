const admin = require('firebase-admin');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const NEW_CHURCHES = [
  {
    name: '萬金聖母聖殿',
    nameEn: 'Basilica of the Immaculate Conception, Wanjin',
    coordinates: [22.595081, 120.611233],
    location: '台灣、屏東縣萬巒鄉',
    type: 'major',
    founded: 1861,
    dedication: '無染原罪聖母',
    style: '巴洛克式',
    significance: '台灣唯一榮獲教宗頒授「乙等聖殿」封號的天主教聖殿，是台灣天主教信仰的朝聖中心，由道明會士創立，見證台灣南部四百年天主教信仰史，被列為國定古蹟',
    description: '萬金聖母聖殿建於1861年，由道明會西班牙籍郭德剛神父創立，是台灣天主教歷史最悠久的聖殿之一。1984年獲教宗若望保祿二世頒授乙等聖殿封號，成為台灣唯一的天主教聖殿。教堂建築融合巴洛克與閩南風格，外觀典雅莊嚴，主祭台供奉無染原罪聖母像。每年12月8日無染原罪聖母瞻禮日，來自全台各地的萬名信徒聚集朝聖，形成著名的「萬金聖誕季」，是台灣規模最大的天主教朝聖活動。',
    viewerUrl: 'wanjin_basilica',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '羅厝天主堂',
    nameEn: 'Church of the Holy Name of Jesus, Luocuo',
    coordinates: [23.937840, 120.513636],
    location: '台灣、彰化縣埔心鄉',
    type: 'chapel',
    founded: 1882,
    dedication: '耶穌聖名',
    style: '哥德式',
    significance: '中台灣歷史最悠久的天主教堂，道明會向北傳教在中部設立的首座教堂，見證彰化地區天主教信仰的萌芽，現存建築為1910年代重建，被列為歷史建築',
    description: '羅厝天主堂，全名羅厝耶穌聖名堂，創立於1882年，是道明會從高雄往北傳教在中台灣設立的第一座教堂。現存的哥德式磚造建築完成於1912年，由西班牙籍傳教士設計，融合歐式教堂風格與台灣在地元素，是台灣中部地區保存最完整的百年天主教堂之一，見證了天主教信仰在彰化平原的深根歷史，現已被列為彰化縣歷史建築。',
    viewerUrl: 'luocuo_holy_name',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '新城天主堂',
    nameEn: 'Xincheng Catholic Church, Hualien',
    coordinates: [24.1290268, 121.650303],
    location: '台灣、花蓮縣新城鄉',
    type: 'chapel',
    founded: 1956,
    dedication: '天主聖三',
    style: '船形現代建築',
    significance: '建於日治時代神社遺址之上，以諾亞方舟為造型的獨特船形教堂，融合日本神道建築遺構與天主教信仰，是台灣東部建築藝術與多元文化融合的典範',
    description: '新城天主堂建於1956年，坐落在日治時代新城神社的舊址之上，至今仍保留了鳥居、石燈籠等日式神社遺構。教堂以諾亞方舟為設計意象，外觀如同一艘乘風破浪的巨船，船頭朝向太平洋，造型獨特。綠意盎然的庭院中，古老的鳥居與白色船形教堂並立，形成東西文化交融的特殊景觀，每年吸引無數信眾與遊客前來朝聖參觀，是花蓮地區重要的宗教文化地標。',
    viewerUrl: 'xincheng_catholic',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '霧台耶穌聖心堂（神山天主堂）',
    nameEn: 'Sacred Heart of Jesus Church, Wutai',
    coordinates: [22.7495, 120.7296],
    location: '台灣、屏東縣霧台鄉',
    type: 'chapel',
    founded: 1953,
    dedication: '耶穌聖心',
    style: '魯凱族石板建築',
    significance: '以在地石板為建材的魯凱族天主堂，將原住民傳統建築美學與天主教信仰融合，是台灣山地原住民族天主教信仰的重要象徵，見證高山部落信仰轉化與文化保存',
    description: '霧台耶穌聖心堂位於屏東縣霧台鄉神山部落，由天主教傳教士與魯凱族人共同建造，以當地石板為主要建材，外觀融合魯凱族傳統建築語彙與天主教堂形式，呈現獨特的山地原住民天主教建築風格。教堂坐落於雲霧繚繞的山巔，四周群山環抱，景色壯麗。神山部落是魯凱族重要的聚落，這座教堂承載著部落居民數十年來的信仰生活，是霧台鄉最具代表性的精神地標之一。',
    viewerUrl: 'wutai_sacred_heart',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '佳平法蒂瑪聖母堂',
    nameEn: 'Our Lady of Fatima Church, Jiaping',
    coordinates: [22.5915, 120.6290],
    location: '台灣、屏東縣泰武鄉',
    type: 'chapel',
    founded: 1953,
    dedication: '法蒂瑪聖母',
    style: '排灣族現代教堂建築',
    significance: '融合排灣族傳統藝術與天主教信仰的朝聖教堂，榮登「世界百大特殊教堂」，2018年落成的新教堂以金碧輝煌的外觀和精緻的排灣族圖騰聞名，是台灣原住民天主教文化藝術的最高結晶',
    description: '佳平法蒂瑪聖母堂位於屏東縣泰武鄉佳平部落，舊教堂建立於1953年，是台灣山地原住民地區最早的天主教堂之一。2018年落成的新教堂融合排灣族琉璃珠、百步蛇、太陽等傳統圖騰，外觀金碧輝煌、精緻華美，被媒體譽為「台灣最美教堂」，更榮登國際媒體「世界百大特殊教堂」名單。教堂內部壁畫、雕刻皆出自排灣族藝術家之手，歌手阿爆（ABAO）的感恩金曲《Thank You》MV即在此拍攝，是台灣原住民族文化與天主教信仰完美融合的藝術聖殿。',
    viewerUrl: 'jiaping_fatima',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '台北聖家堂',
    nameEn: 'Holy Family Catholic Church, Taipei',
    coordinates: [25.0337, 121.5297],
    location: '台灣、台北市大安區',
    type: 'chapel',
    founded: 1965,
    dedication: '聖家（耶穌、瑪利亞、若瑟）',
    style: '現代教堂建築',
    significance: '台北市大安區重要的天主教信仰中心，以聖家（耶穌、聖母瑪利亞與聖若瑟）為主保，提供台北市中心信眾靈修與禮儀服務，是台北總教區重要的堂區',
    description: '台北聖家堂位於台北市大安區新生南路二段，以耶穌、聖母瑪利亞與聖若瑟組成的聖家為主保，是台北市大安區最重要的天主教堂之一。教堂建築現代簡潔，內部空間寬敞莊嚴，每日舉行彌撒，服務周邊大安、信義區的天主教信眾。教堂鄰近大安森林公園，交通便利，長期作為台北市區天主教信仰生活的重要據點，吸引許多學生與上班族信眾定期參與聖事禮儀。',
    viewerUrl: 'taipei_holy_family',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '五峰旗聖母朝聖地',
    nameEn: 'Sanctuary of Our Lady of Wufengqi, Jiaoxi',
    coordinates: [24.83289805, 121.74509970],
    location: '台灣、宜蘭縣礁溪鄉',
    type: 'chapel',
    founded: 1979,
    dedication: '聖母瑪利亞',
    style: '仿天壇圓形建築',
    significance: '台灣東北部重要的天主教聖母朝聖地，坐落五峰旗山腰，背山面海俯瞰太平洋，是靈醫會在宜蘭傳教的精神象徵，吸引全台信眾登山朝聖，體驗山間靜謐的靈修氛圍',
    description: '五峰旗聖母朝聖地位於宜蘭縣礁溪鄉五峰旗山腰，1979年由天主教靈醫會巴瑞士修士在三角崙山腰豎立一尊聖母像，成為登山者的守護者。朝聖地占地約700坪，背山面海，左右群山環抱，面向太平洋景色壯麗。2005年仿天壇造型的圓形教堂建築完工，中央廣場設有聖母巖洞，是宜蘭地區最重要的天主教朝聖地。前往朝聖需步行穿越五峰旗瀑布步道約15至20分鐘，沿途自然景色優美，融合登山健行與靈修朝聖的雙重體驗。',
    viewerUrl: 'wufengqi_sanctuary',
    panoramaId: null,
    videoUrl: null,
  },
  {
    name: '小馬天主堂',
    nameEn: 'St. Nicholas Church, Xiaoma',
    coordinates: [22.99555, 121.3153],
    location: '台灣、台東縣成功鎮',
    type: 'chapel',
    founded: 1968,
    dedication: '聖尼克老',
    style: '石板錐形屋頂建築',
    significance: '白冷會傅義修士的代表建築作品，以在地大理石為材料的獨特錐形建築，被列為台東縣歷史建築，見證白冷會修士在台灣東部原住民部落的建築藝術與傳教使命',
    description: '小馬天主堂，全名小馬聖尼克老堂，位於台東縣成功鎮小馬部落，建於1968年，由瑞士白冷外方傳教會傅義修士設計建造。教堂以錐形尖塔屋頂為特色，牆面採用當地採集的大理石石板，傅義修士就地取材，以天然石材製作壁畫裝飾，四周牆壁掛有阿美族風格的木雕圖案，錐形屋頂與牆面間設多格窗孔引入自然光照射祭臺，空間神聖而質樸。2005年被公告列為台東縣歷史建築，是白冷會在台灣東部留下的珍貴建築遺產，見證外籍傳教士與台灣原住民族共同創造的信仰文化結晶。',
    viewerUrl: 'xiaoma_st_nicholas',
    panoramaId: null,
    videoUrl: null,
  },
];

async function run() {
  const col = db.collection('basilicas');

  const snap = await col.get();
  const existingViewerUrls = new Set(snap.docs.map(d => d.data().viewerUrl).filter(Boolean));

  console.log(`📦 Firestore 目前共有 ${snap.size} 筆教堂資料\n`);

  let inserted = 0;
  let skipped = 0;

  for (const church of NEW_CHURCHES) {
    if (existingViewerUrls.has(church.viewerUrl)) {
      console.log(`⏭️  略過（已存在）: ${church.name}`);
      skipped++;
      continue;
    }
    await col.add(church);
    console.log(`✅ 已新增: ${church.name} [${church.coordinates[0]}, ${church.coordinates[1]}]`);
    inserted++;
  }

  const finalSnap = await col.get();
  console.log(`\n📊 完成！新增 ${inserted} 筆，略過 ${skipped} 筆。`);
  console.log(`📊 basilicas collection 目前共有 ${finalSnap.size} 個教堂。`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});
