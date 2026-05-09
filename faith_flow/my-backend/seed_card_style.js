require('dotenv').config();
const pool = require('./config/database');
async function main() {
  const r = await pool.query(
    "INSERT INTO card_styles (style_name, front_image_url) VALUES ('default', '') RETURNING card_style_id"
  );
  console.log('預設卡片樣式已建立，card_style_id:', r.rows[0].card_style_id);
  pool.end();
}
main().catch(e => { console.error(e.message); pool.end(); });