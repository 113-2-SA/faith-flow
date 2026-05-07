// ==================== routes/diarys.js ====================

const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const diarycontroller = require("../controllers/diarycontroller");
const attachUserId = require('../middleware/attachuserId');
const auth = [verifyToken, attachUserId];

console.log({
  verifyToken: typeof verifyToken,
  createDiary: typeof diarycontroller.createDiary,
  getDiaries: typeof diarycontroller.getDiaries,
  searchDiaries: typeof diarycontroller.searchDiaries,
  getDiaryByDate: typeof diarycontroller.getDiaryByDate,
  getDiaryById: typeof diarycontroller.getDiaryById,
  updateDiary: typeof diarycontroller.updateDiary,
  deleteDiary: typeof diarycontroller.deleteDiary,
});



// 所有路由都需要登入
router.use(verifyToken);

// GET /api/diary/stats
router.get("/stats",verifyToken, attachUserId, diarycontroller.getStats);

// GET /api/diary
router.get("/",verifyToken, attachUserId, diarycontroller.getDiaries);

// GET /api/diary/search
router.get("/search", verifyToken, attachUserId, diarycontroller.searchDiaries);

// 固定路徑必須在 /:id 之前，否則會被當成 ID
router.post('/from-prayer', auth, diarycontroller.createFromPrayer);
router.post('/preview-prayer', auth, diarycontroller.previewPrayer);
router.get('/prayer-locations', auth, diarycontroller.getPrayerLocations);

// GET /api/diary/:id
router.get("/:id", verifyToken, attachUserId, diarycontroller.getDiaryById);

// PUT /api/diary/:id
router.put("/:id", verifyToken, attachUserId, diarycontroller.updateDiary);

// POST /api/diary
router.post("/", verifyToken, attachUserId, diarycontroller.createDiary);

// DELETE /api/diary/:id
router.delete("/:id", verifyToken, attachUserId, diarycontroller.deleteDiary);

// GET /api/diary/date/:date
router.get("/date/:date", verifyToken, attachUserId, diarycontroller.getDiaryByDate);

module.exports = router;