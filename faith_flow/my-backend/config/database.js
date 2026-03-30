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

// // 測試資料庫連線
//   pool
//     .query(`
//       SELECT current_database() AS db,
//             current_schema()   AS schema,
//             current_user       AS db_user,
//             inet_server_addr() AS server_ip,
//             inet_server_port() AS server_port;
//     `)
//     .then((r) => console.log("[DB CHECK]", r.rows[0]))
//     .catch((e) => console.error("[DB CHECK ERROR]", e.message));

  module.exports = pool;