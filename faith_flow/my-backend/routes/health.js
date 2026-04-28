// ==================== routes/health.js ====================
const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authService = require("../services/authservice");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT now() AS db_time,
             current_database() AS db,
             current_user AS db_user,
             current_schema() AS schema
    `);
    
    res.json({
      ok: true,
      server: "Faith-Flow API",
      status: "running",
      database: result.rows[0]
    });
  } catch (error) {
    console.error("健康檢查失敗:", error.message);
    res.status(500).json({
      ok: false,
      error: "資料庫連線失敗",
      detail: error.message
    });
  }
});

router.get("/debug-users", async (req, res) => {
  try {
    const users = await authService.getAllUsers(50);
    
    res.json({
      ok: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error("查詢使用者失敗:", error.message);
    res.status(500).json({
      ok: false,
      error: "查詢使用者資料失敗",
      detail: error.message
    });
  }
});

module.exports = router;