// ==================== test_db.js ====================
require('dotenv').config(); // 載入 .env
const pool = require('./config/database');

async function testConnection() {
  console.log('🔍 測試資料庫連線...\n');
  
  try {
    // 測試連線
    const client = await pool.connect();
    console.log('✅ 資料庫連線成功!\n');
    
    // 查詢資料庫資訊
    const dbInfo = await client.query(`
      SELECT current_database() AS db,
             current_user       AS user,
             version()          AS version;
    `);
    console.log('📊 資料庫資訊:');
    console.log('  資料庫:', dbInfo.rows[0].db);
    console.log('  使用者:', dbInfo.rows[0].user);
    console.log('  版本:', dbInfo.rows[0].version.split('\n')[0]);
    
    // 查詢用戶數量
    const userCount = await client.query('SELECT COUNT(*) FROM "user"');
    console.log('\n👥 用戶數量:', userCount.rows[0].count);
    
    // 列出用戶
    const users = await client.query('SELECT "userID", username, email FROM "user" ORDER BY "userID" LIMIT 5');
    console.log('\n📝 用戶列表 (前 5 筆):');
    users.rows.forEach(user => {
      console.log(`  [${user.userID}] ${user.username} - ${user.email}`);
    });
    
    client.release();
    
    console.log('\n🎉 測試完成!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    console.error('\n請檢查:');
    console.error('  1. Docker 容器是否在運行? (執行 docker ps)');
    console.error('  2. .env 的 DATABASE_URL 是否正確?');
    console.error('  3. PostgreSQL 是否已完全啟動? (等待 30 秒)');
    process.exit(1);
  }
}

testConnection();