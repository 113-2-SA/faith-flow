require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const tables = ['cards_unlock', 'user_cards', 'user_draws', 'weekly_cards', 'letters'];
  for (const t of tables) {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '" + t + "' ORDER BY ordinal_position");
    console.log('\n=== ' + t + ' ===');
    r.rows.forEach(row => console.log(' ', row.column_name, ':', row.data_type));
  }
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });
