require('dotenv').config();
const pool = require('./config/database');

const TO_DELETE = [
  'tainan_rosary',
  'taipei_st_joseph',
  'hualien_st_joseph',
  'taichung_sacred_heart',
  'kaohsiung_st_john',
];

const NEW_CHURCH = {
  pname: '玫瑰聖母聖殿主教座堂',
  name_en: 'Cathedral Basilica of Our Lady of the Rosary, Kaohsiung',
  latitude: 22.62560,
  longitude: 120.30250,
  location: '台灣、高雄市苓雅區',
  description: '建於1860年，由道明會士創立，是台灣南部歷史最悠久的天主教堂之一。教堂融合哥德式與羅馬式建築風格，外觀宏偉壯麗，以彩色玫瑰窗和精緻的石雕聞名。作為高雄教區的主教座堂，同時享有聖殿（Basilica）封號，是台灣天主教信仰的重要地標，每年吸引大量信徒與旅客前來朝聖。',
  dedication: '玫瑰聖母',
  founded: '1860-01-01',
  significance: '台灣南部最重要的天主教聖殿，高雄教區主教座堂，兼具聖殿與主教座堂雙重地位，是台灣現存最古老的哥德式天主教建築之一',
  arch_style: '哥德式、羅馬式',
  ptype: 'major',
  panorama_id: null,
  panorama_status: 'ZERO_RESULTS',
  street_view_url: null,
  viewer_url: 'kaohsiung_rosary',
};

async function run() {
  try {
    const del = await pool.query(
      'DELETE FROM places WHERE viewer_url = ANY($1) RETURNING pname',
      [TO_DELETE]
    );
    console.log(`🗑️  已從 PostgreSQL 刪除 ${del.rowCount} 筆舊資料:`);
    del.rows.forEach(r => console.log(`   - ${r.pname}`));

    const exists = await pool.query('SELECT 1 FROM places WHERE viewer_url = $1', [NEW_CHURCH.viewer_url]);
    if (exists.rowCount > 0) {
      console.log(`⏭️  略過（已存在）: ${NEW_CHURCH.pname}`);
    } else {
      await pool.query(
        `INSERT INTO places
          (pname, name_en, latitude, longitude, location, description,
           dedication, founded, significance, arch_style, ptype,
           panorama_id, panorama_status, street_view_url, viewer_url,
           created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
        [
          NEW_CHURCH.pname, NEW_CHURCH.name_en,
          NEW_CHURCH.latitude, NEW_CHURCH.longitude,
          NEW_CHURCH.location, NEW_CHURCH.description,
          NEW_CHURCH.dedication, NEW_CHURCH.founded,
          NEW_CHURCH.significance, NEW_CHURCH.arch_style,
          NEW_CHURCH.ptype, NEW_CHURCH.panorama_id,
          NEW_CHURCH.panorama_status, NEW_CHURCH.street_view_url,
          NEW_CHURCH.viewer_url,
        ]
      );
      console.log(`✅ 已新增: ${NEW_CHURCH.pname}`);
    }

    const count = await pool.query('SELECT COUNT(*) FROM places');
    console.log(`\n📊 places 資料表目前共有 ${count.rows[0].count} 個地點。`);
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

run();
