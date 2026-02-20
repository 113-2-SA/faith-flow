// ==================== config/database.js ====================
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL 資料庫已連線");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL 連線錯誤:", err.message);
});

module.exports = pool;