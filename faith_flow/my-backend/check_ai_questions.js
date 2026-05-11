require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ai_questions' ORDER BY ordinal_position");
  console.log('=== ai_questions ===');
  r.rows.forEach(row => console.log(' ', row.column_name, ':', row.data_type));
  
  // 看幾筆資料
  const r2 = await pool.query('SELECT * FROM ai_questions LIMIT 3');
  console.log('\n=== 範例資料 ===');
  r2.rows.forEach(row => console.log(row));
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
