// ==================== routes/diarys.js ====================

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const diaryController = require("../controllers/diarycontroller");

console.log({
  verifyToken: typeof verifyToken,
  createDiary: typeof diaryController.createDiary,
  getDiaries: typeof diaryController.getDiaries,
  searchDiaries: typeof diaryController.searchDiaries,
  getDiaryByDate: typeof diaryController.getDiaryByDate,
  getDiaryById: typeof diaryController.getDiaryById,
  updateDiary: typeof diaryController.updateDiary,
  deleteDiary: typeof diaryController.deleteDiary,
});



// 所有路由都需要登入
router.use(verifyToken);

// POST /api/diary
router.post("/", diaryController.createDiary);

// GET /api/diary
router.get("/", diaryController.getDiaries);

// GET /api/diary/search
router.get("/search", diaryController.searchDiaries);

// GET /api/diary/date/:date
router.get("/date/:date", diaryController.getDiaryByDate);

// GET /api/diary/:id
router.get("/:id", diaryController.getDiaryById);

// PUT /api/diary/:id
router.put("/:id", diaryController.updateDiary);

// DELETE /api/diary/:id
router.delete("/:id", diaryController.deleteDiary);

module.exports = router;