require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const r = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations' ORDER BY ordinal_position"
  );
  r.rows.forEach(row => console.log(row.column_name, ':', row.data_type));
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });