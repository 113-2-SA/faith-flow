require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const r1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'card_styles' ORDER BY ordinal_position");
  console.log('=== card_styles ===');
  r1.rows.forEach(row => console.log(' ', row.column_name, ':', row.data_type));
  
  const r2 = await pool.query('SELECT * FROM card_styles LIMIT 3');
  console.log('\n=== card_styles 資料 ===');
  r2.rows.forEach(row => console.log(row));

  const r3 = await pool.query('SELECT * FROM weekly_cards LIMIT 5');
  console.log('\n=== weekly_cards 現有資料 ===');
  console.log(r3.rows.length === 0 ? '（空的）' : r3.rows);
  
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
