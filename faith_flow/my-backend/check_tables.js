require('dotenv').config();
const pool = require('./config/database');
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
  .then(r => { r.rows.forEach(row => console.log(row.table_name)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
