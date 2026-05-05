const { Pool } = require('pg');

console.log('='.repeat(50));
console.log('Docker PostgreSQL 連線測試');
console.log('='.repeat(50));

const pool = new Pool({
  host: 'localhost',
  port: 5433,  // ← 改這裡
  database: 'faithflowdb',
  user: 'faithuser',
  password: 'faith2024'
});

async function test() {
  try {
    console.log('\n🔍 測試連線...');
    
    const res = await pool.query('SELECT current_user, current_database()');
    console.log('✅ 連線成功!\n');
    console.log('使用者:', res.rows[0].current_user);
    console.log('資料庫:', res.rows[0].current_database);
    
    const count = await pool.query('SELECT COUNT(*) FROM "user"');
    console.log('用戶數:', count.rows[0].count);
    
    if (count.rows[0].count > 0) {
      const users = await pool.query('SELECT "userID", username, email FROM "user"');
      console.log('\n用戶列表:');
      users.rows.forEach(u => console.log(`  [${u.userID}] ${u.username} - ${u.email}`));
    }
    
    await pool.end();
    console.log('\n' + '='.repeat(50));
    console.log('🎉 測試完成!');
    console.log('='.repeat(50));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    await pool.end();
    process.exit(1);
  }
}

test();