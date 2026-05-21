require('dotenv').config();
const pool = require('./config/database');

async function run() {
  const r = await pool.query(
    'UPDATE places SET latitude=$1, longitude=$2, updated_at=NOW() WHERE viewer_url=$3 RETURNING pname, latitude, longitude',
    [22.6203245, 120.2916188, 'kaohsiung_rosary']
  );
  if (r.rowCount === 0) {
    console.log('❌ 找不到記錄');
  } else {
    console.log('✅ PostgreSQL 座標已更新:', r.rows[0]);
  }
  await pool.end();
}

run().catch(e => { console.error('❌', e.message); pool.end(); });
