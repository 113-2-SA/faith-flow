// ==================== routes/user.js ====================
// 使用者個人資料相關的路由

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const userController = require("../controllers/usercontroller");

// 所有路由都需要登入
router.use(verifyToken);

/**
 * GET /api/user/profile
 * 取得目前登入使用者的個人資料
 */
router.get("/profile", userController.getMyProfile);

/**
 * PUT /api/user/profile
 * 更新使用者的自我介紹
 * Body: { profile: "我的自我介紹..." }
 */
router.put("/profile", userController.updateProfile);

/**
 * PATCH /api/user/profile
 * 更新使用者的完整個人資料（可以只更新部分欄位）
 * Body: { userName?: "新名字", usePic?: "url", profile?: "介紹" }
 */
router.patch("/profile", userController.updateUserInfo);

module.exports = router;