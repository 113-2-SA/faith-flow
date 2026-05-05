const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'faithflowdb',
  user: 'faithuser',
  password: 'faith2024'
});

pool.query('SELECT "userID", username, email FROM "user"')
  .then(res => {
    console.log('✅ 後端連線成功!');
    console.log('📊 用戶列表:');
    res.rows.forEach(u => console.log(`  [${u.userID}] ${u.username} - ${u.email}`));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
  });