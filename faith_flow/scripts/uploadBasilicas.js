require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../faith-flow-82991-firebase-adminsdk-fbsvc-05c9ad34a3.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

const BASILICAS = [
  {
    id: "stpeter_vatican",
    name: "聖彼得大教堂",
    nameEn: "St. Peter's Basilica",
    location: "梵諦岡",
    coordinates: [41.9029, 12.4534],
    type: "major",
    founded: 1626,
    dedication: "聖彼得",
    style: "文藝復興、巴洛克",
    significance: "天主教會的精神中心，教宗主持彌撒的地點",
    description: "世界上最大的教堂，容納 60,000 人，是基督教的象徵。聖彼得被埋葬在教堂下方。",
    viewerUrl: "stpeter"
  },
  {
    id: "stpaul_vatican",
    name: "聖保羅大教堂",
    nameEn: "St. Paul's Basilica",
    location: "梵諦岡、羅馬",
    coordinates: [41.8584, 12.4767],
    type: "major",
    founded: 386,
    dedication: "聖保羅",
    style: "早期基督教、文藝復興、巴洛克",
    significance: "紀念聖保羅殉教的聖地，四大聖殿之一",
    description: "容納 3,000 人，以金色馬賽克和聖保羅遺骨聞名。",
    viewerUrl: "stpaul"
  },
  {
    id: "santa_maria_maggiore",
    name: "聖母瑪利亞大殿",
    nameEn: "Basilica of St. Mary Major",
    location: "羅馬",
    coordinates: [41.8986, 12.4982],
    type: "major",
    founded: 432,
    dedication: "聖母瑪利亞",
    style: "早期基督教、文藝復興",
    significance: "紀念聖母瑪利亞的四大聖殿之一",
    description: "擁有最古老的馬賽克天花板，象徵聖母的榮耀。",
    viewerUrl: "santa_maria"
  },
  {
    id: "san_giovanni",
    name: "聖若望聖殿",
    nameEn: "Basilica of St. John Lateran",
    location: "羅馬",
    coordinates: [41.8832, 12.5033],
    type: "major",
    founded: 324,
    dedication: "聖若望洗者",
    style: "早期基督教、巴洛克",
    significance: "教宗的主座聖殿，四大聖殿之一",
    description: "羅馬最古老的教堂，見證了 1700 年的信仰歷史。",
    viewerUrl: "san_giovanni"
  },
  {
    id: "basilica_assisi",
    name: "聖方濟各大殿",
    nameEn: "Basilica of St. Francis of Assisi",
    location: "亞西西",
    coordinates: [43.0730, 12.5987],
    type: "major",
    founded: 1253,
    dedication: "聖方濟各",
    style: "哥德式、文藝復興",
    significance: "聖方濟各的聖骨地，朝聖的重要地點",
    description: "包含美麗的濕壁畫，講述聖方濟各的生平故事。",
    viewerUrl: "assisi"
  },
  {
    id: "santiago_compostela",
    name: "聖地亞哥聖殿",
    nameEn: "Cathedral of Santiago de Compostela",
    location: "西班牙",
    coordinates: [42.5806, -8.5457],
    type: "cathedral",
    founded: 1211,
    dedication: "聖地亞哥（聖雅各）",
    style: "羅馬式、巴洛克",
    significance: "朝聖之路的終點，重要的朝聖地點",
    description: "擁有聖雅各的遺骨，吸引無數朝聖者。",
    viewerUrl: "santiago"
  },
  {
    id: "reims_cathedral",
    name: "蘭斯聖母聖殿",
    nameEn: "Reims Cathedral",
    location: "法國",
    coordinates: [49.2514, 4.0361],
    type: "cathedral",
    founded: 1211,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "法國國王加冕的聖地，聖靈的傳承地",
    description: "傳統上，法國國王在此舉行加冕典禮。",
    viewerUrl: "reims"
  },
  {
    id: "chartres_cathedral",
    name: "沙特爾聖母聖殿",
    nameEn: "Chartres Cathedral",
    location: "法國",
    coordinates: [48.4408, 1.4901],
    type: "cathedral",
    founded: 1220,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "聖母的聖衣之地，朝聖中心",
    description: "以美麗的彩繪玻璃窗和高尖塔聞名。",
    viewerUrl: "chartres"
  },
  {
    id: "notre_dame_paris",
    name: "巴黎聖母院",
    nameEn: "Notre-Dame de Paris",
    location: "法國",
    coordinates: [48.8530, 2.3499],
    type: "cathedral",
    founded: 1345,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "法國文化象徵，聖母信仰中心",
    description: "以其宏偉的建築和豐富的宗教藝術聞名。",
    viewerUrl: "notre_dame"
  },
  {
    id: "cologne_cathedral",
    name: "科隆大教堂",
    nameEn: "Cologne Cathedral",
    location: "德國",
    coordinates: [50.9406, 6.9585],
    type: "cathedral",
    founded: 1322,
    dedication: "聖母瑪利亞及聖王",
    style: "德國哥德式",
    significance: "聖三王遺骨之地，中世紀信仰中心",
    description: "世界遺產，以雙尖塔和精美工藝聞名。",
    viewerUrl: "cologne"
  },
  {
    id: "jingxin_chapel_fujen",
    name: "輔仁大學淨心堂",
    nameEn: "Jingxin Chapel, Fujen University",
    location: "台灣、新北市、新莊",
    coordinates: [25.0324, 121.4286],
    type: "chapel",
    founded: 1961,
    dedication: "聖母與聖若望",
    style: "現代教堂建築",
    significance: "台灣天主教高等教育的精神中心，輔仁大學的信仰象徵",
    description: "輔仁大學淨心堂是台灣重要的教堂，座落在輔仁大學校園內。作為天主教大學的精神中心，淨心堂承載著信仰教育的使命，每日為師生提供靈修空間。",
    viewerUrl: "jingxin"
  },
  {
    id: "holy_sepulchre",
    name: "聖墓教堂",
    nameEn: "Church of the Holy Sepulchre",
    location: "耶路撒冷",
    coordinates: [31.7780, 35.2296],
    type: "chapel",
    founded: 335,
    dedication: "耶穌基督的復活",
    style: "拜占庭式、哥德式",
    significance: "基督復活的傳統地點，是基督教最重要的朝聖地之一。",
    description: "聖墓教堂內包含耶穌被釘十字架、埋葬與復活的場所，吸引來自世界各地的朝聖者。",
    viewerUrl: "holy_sepulchre"
  },
  {
    id: "church_of_the_nativity",
    name: "聖誕教堂",
    nameEn: "Church of the Nativity",
    location: "伯利恆",
    coordinates: [31.7054, 35.2024],
    type: "chapel",
    founded: 339,
    dedication: "耶穌的誕生",
    style: "羅馬式、拜占庭式",
    significance: "傳統上被視為耶穌誕生地，是歷史最悠久的教堂之一。",
    description: "教堂建於聖赫羅德時期，保有早期基督教建築遺跡，並為四大聖地之一。",
    viewerUrl: "nativity"
  },
  {
    id: "annunciation_church",
    name: "聖母領報堂",
    nameEn: "Basilica of the Annunciation",
    location: "拿撒勒",
    coordinates: [32.7040, 35.2954],
    type: "chapel",
    founded: 1969,
    dedication: "聖母領報",
    style: "現代主義",
    significance: "傳統上認為是天使向聖母宣報耶穌降生的地點，是敬禮聖母的重要朝聖地。",
    description: "教堂內保存了早期基督教和十字軍時期的遺跡，並於 20 世紀重建成多層設計的聖殿。",
    viewerUrl: "annunciation"
  },
  {
    id: "multiplication_church",
    name: "五餅二魚堂",
    nameEn: "Church of the Multiplication",
    location: "塔布加，加利利海",
    coordinates: [32.8771, 35.5694],
    type: "chapel",
    founded: 350,
    dedication: "耶穌行五餅二魚奇蹟",
    style: "拜占庭式",
    significance: "傳說耶穌在此用五餅二魚餵飽了五千人，是信仰力量的象徵。",
    description: "教堂內保存著傳統上相信是耶穌祝禱的五餅二魚石盤遺跡，吸引眾多朝聖者到訪。",
    viewerUrl: "multiplication"
  },
  {
    id: "st_peter_gallicantu",
    name: "雞鳴堂",
    nameEn: "St. Peter in Gallicantu",
    location: "耶路撒冷",
    coordinates: [31.7765, 35.2303],
    type: "chapel",
    founded: 1931,
    dedication: "聖伯多祿的三次不認主",
    style: "拜占庭復興式",
    significance: "傳統上認為彼得在此三次不認主後悔，提醒信徒悔改與信德堅定。",
    description: "教堂建於耶穌被囚禁的古羅馬宮殿遺址上，並保留了古代地下洞穴和鷹嘴石遺跡。",
    viewerUrl: "gallicantu"
  }
];

async function uploadBasilicas() {
  try {
    console.log('開始上傳教堂資料...');
    for (const basilica of BASILICAS) {
      const { id, ...data } = basilica; // 移除id，因為Firestore會自動生成
      await db.collection('basilicas').add(data);
      console.log(`已上傳: ${basilica.name}`);
    }
    console.log('所有教堂資料上傳完成！');
  } catch (error) {
    console.error('上傳失敗:', error);
  }
}

uploadBasilicas();