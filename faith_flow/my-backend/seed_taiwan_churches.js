require('dotenv').config();
const pool = require('./config/database');

const taiwanChurches = [
  {
    pname: '台南玫瑰聖母聖殿主教座堂',
    name_en: 'Cathedral Basilica of Our Lady of the Rosary',
    latitude: 22.99960,
    longitude: 120.19910,
    location: '台灣、台南市中西區',
    description: '建於1636年，是台灣歷史最悠久的天主教堂，由西班牙道明會士創立。以玫瑰聖母命名，被列為國定古蹟，保存了台灣天主教早期傳教的珍貴歷史遺跡。現存建築為1929年重建，融合了歐式巴洛克與在地風格，是台南市重要的文化地標。',
    dedication: '玫瑰聖母',
    founded: '1636-01-01',
    significance: '台灣天主教信仰的搖籃，道明會在台灣傳教的根據地，見證近四百年信仰傳承，為台灣歷史最悠久的天主教聖殿',
    arch_style: '巴洛克式',
    ptype: 'major',
    panorama_id: null,
    panorama_status: 'ZERO_RESULTS',
    street_view_url: null,
    viewer_url: 'tainan_rosary',
  },
  {
    pname: '台北聖若瑟主教座堂',
    name_en: 'Cathedral of Saint Joseph, Taipei',
    latitude: 25.06280,
    longitude: 121.51300,
    location: '台灣、台北市大同區',
    description: '台北總教區的主教座堂，是台灣北部天主教信仰的中心。教堂建築典雅莊嚴，每逢重要節日舉行盛大禮儀，是台北天主教社群的精神家園，也是主教牧靈工作的核心所在。',
    dedication: '聖若瑟',
    founded: '1949-01-01',
    significance: '台北總教區的主座教堂，台灣天主教行政與禮儀中心，全台最重要的主教座堂之一',
    arch_style: '現代教堂建築',
    ptype: 'cathedral',
    panorama_id: null,
    panorama_status: 'ZERO_RESULTS',
    street_view_url: null,
    viewer_url: 'taipei_st_joseph',
  },
  {
    pname: '花蓮聖若瑟主教座堂',
    name_en: 'Cathedral of Saint Joseph, Hualien',
    latitude: 23.97690,
    longitude: 121.60130,
    location: '台灣、花蓮縣花蓮市',
    description: '花蓮教區的主教座堂，見證了天主教在台灣東部原住民社群中的深厚根基。花蓮教區擁有台灣比例最高的天主教信徒，教堂是信仰社群的凝聚中心，也是台灣後山地區靈修與文化的重要據點。',
    dedication: '聖若瑟',
    founded: '1948-01-01',
    significance: '花蓮教區主教座堂，台灣東部天主教信仰中心，見證原住民族與天主教信仰深度結合的歷史',
    arch_style: '現代教堂建築',
    ptype: 'cathedral',
    panorama_id: null,
    panorama_status: 'ZERO_RESULTS',
    street_view_url: null,
    viewer_url: 'hualien_st_joseph',
  },
  {
    pname: '台中聖心主教座堂',
    name_en: 'Cathedral of the Sacred Heart, Taichung',
    latitude: 24.14590,
    longitude: 120.67440,
    location: '台灣、台中市西區',
    description: '台中教區的主教座堂，以聖心（耶穌聖心）為主保，是台灣中部天主教信仰的核心。教堂建築宏偉，承載著台中地區數十年來的天主教信仰歷史，每年舉行多項重要禮儀活動。',
    dedication: '耶穌聖心',
    founded: '1950-01-01',
    significance: '台中教區主教座堂，台灣中部天主教信仰與行政中心，見證中台灣的福傳歷史',
    arch_style: '現代教堂建築',
    ptype: 'cathedral',
    panorama_id: null,
    panorama_status: 'ZERO_RESULTS',
    street_view_url: null,
    viewer_url: 'taichung_sacred_heart',
  },
  {
    pname: '高雄聖若望主教座堂',
    name_en: 'Cathedral of Saint John, Kaohsiung',
    latitude: 22.62500,
    longitude: 120.30200,
    location: '台灣、高雄市新興區',
    description: '高雄教區的主教座堂，以聖若望（聖約翰）為主保，是南台灣天主教信仰的重心。教堂坐落於高雄市中心，長期為高雄地區天主教社群提供靈性滋養與牧靈服務，是南台灣最重要的天主教聖殿之一。',
    dedication: '聖若望宗徒',
    founded: '1955-01-01',
    significance: '高雄教區主教座堂，南台灣天主教信仰中心，高雄市天主教社群的精神家園',
    arch_style: '現代教堂建築',
    ptype: 'cathedral',
    panorama_id: null,
    panorama_status: 'ZERO_RESULTS',
    street_view_url: null,
    viewer_url: 'kaohsiung_st_john',
  },
];

async function seed() {
  try {
    const existing = await pool.query(
      "SELECT viewer_url FROM places WHERE viewer_url = ANY($1)",
      [taiwanChurches.map(c => c.viewer_url)]
    );
    const existingSlugs = new Set(existing.rows.map(r => r.viewer_url));

    let inserted = 0;
    let skipped = 0;

    for (const church of taiwanChurches) {
      if (existingSlugs.has(church.viewer_url)) {
        console.log(`⏭️  略過（已存在）: ${church.pname}`);
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO places
          (pname, name_en, latitude, longitude, location, description,
           dedication, founded, significance, arch_style, ptype,
           panorama_id, panorama_status, street_view_url, viewer_url,
           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
        [
          church.pname, church.name_en,
          church.latitude, church.longitude,
          church.location, church.description,
          church.dedication, church.founded,
          church.significance, church.arch_style,
          church.ptype, church.panorama_id,
          church.panorama_status, church.street_view_url,
          church.viewer_url,
        ]
      );
      console.log(`✅ 已新增: ${church.pname}`);
      inserted++;
    }

    const count = await pool.query('SELECT COUNT(*) FROM places');
    console.log(`\n📊 完成！新增 ${inserted} 筆，略過 ${skipped} 筆。`);
    console.log(`📊 places 資料表目前共有 ${count.rows[0].count} 個地點。`);
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

seed();
