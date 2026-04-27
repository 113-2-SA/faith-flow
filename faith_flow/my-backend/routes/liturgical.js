// ==================== routes/liturgical.js ====================
const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");

// 根據禮儀季節決定顏色
function getSeasonColor(season) {
  if (season.includes("將臨期") || season.includes("四旬期")) return "purple";
  if (season.includes("復活期") || season.includes("聖誕期")) return "white";
  if (season.includes("常年期")) return "green";
  return "white";
}

// GET /api/liturgical?date=YYYY-MM-DD
router.get("/", verifyToken, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "請提供有效的日期格式 YYYY-MM-DD" });
    }

    const result = await pool.query(
      "SELECT * FROM liturgical_calendar WHERE date = $1",
      [date]
    );

    if (result.rows.length === 0) {
      return res.json({ ok: true, data: null });
    }

    const row = result.rows[0];

    const data = {
      season: row.season,
      seasonColor: getSeasonColor(row.season),
      feast: row.celebration,
      rank: row.liturgical_rank,
    };

    res.json({ ok: true, data });
  } catch (error) {
    console.error("獲取禮儀資料失敗:", error.message);
    res.status(500).json({ ok: false, error: "伺服器錯誤" });
  }
});

module.exports = router;
