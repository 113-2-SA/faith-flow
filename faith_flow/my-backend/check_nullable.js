require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const r = await pool.query(
    "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'weekly_cards' ORDER BY ordinal_position"
  );
  r.rows.forEach(row => console.log(row.column_name, '| nullable:', row.is_nullable, '| default:', row.column_default));
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });