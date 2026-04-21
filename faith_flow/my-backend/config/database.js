// ==================== config/database.js ====================
const { Pool } = require("pg");

//連接本地postgresql資料庫
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
// });

//連接supabase的postgresql資料庫
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL 資料庫已連線");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL 連線錯誤:", err.message);
});

  module.exports = pool;