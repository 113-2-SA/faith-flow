// ==================== controllers/userController.js ====================
// 使用者個人資料相關的控制器

const userService = require("../services/userservice");

/**
 * 取得目前登入使用者的個人資料
 * GET /api/user/profile
 */
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid; // 從 verifyToken 中介軟體取得
    
    const user = await userService.getUserProfile(userId);
    
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "找不到使用者資料"
      });
    }
    
    res.json({
      ok: true,
      data: user
    });
  } catch (error) {
    console.error("[getMyProfile] 錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "取得個人資料失敗"
    });
  }
};

/**
 * 更新使用者的自我介紹
 * PUT /api/user/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { profile } = req.body;
    
    // 驗證
    if (profile === undefined || profile === null) {
      return res.status(400).json({
        ok: false,
        error: "請提供 profile 欄位"
      });
    }
    
    // 長度限制（可選）
    if (profile.length > 500) {
      return res.status(400).json({
        ok: false,
        error: "自我介紹不能超過 500 字"
      });
    }
    
    const updatedUser = await userService.updateUserProfile(userId, profile);
    
    if (!updatedUser) {
      return res.status(404).json({
        ok: false,
        error: "找不到使用者"
      });
    }
    
    res.json({
      ok: true,
      message: "更新成功",
      data: updatedUser
    });
  } catch (error) {
    console.error("[updateProfile] 錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "更新失敗"
    });
  }
};

/**
 * 更新使用者的完整個人資料
 * PATCH /api/user/profile
 */
exports.updateUserInfo = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { userName, usePic, profile } = req.body;
    
    // 至少要有一個欄位
    if (!userName && !usePic && profile === undefined) {
      return res.status(400).json({
        ok: false,
        error: "至少需要提供一個要更新的欄位"
      });
    }
    
    const updatedUser = await userService.updateUserInfo(userId, {
      userName,
      usePic,
      profile
    });
    
    if (!updatedUser) {
      return res.status(404).json({
        ok: false,
        error: "找不到使用者"
      });
    }
    
    res.json({
      ok: true,
      message: "更新成功",
      data: updatedUser
    });
  } catch (error) {
    console.error("[updateUserInfo] 錯誤:", error);
    res.status(500).json({
      ok: false,
      error: error.message || "更新失敗"
    });
  }
};

/**
 * 取得指定使用者的公開個人資料
 * GET /api/user/:userId
 */
exports.getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ ok: false, error: "無效的使用者 ID" });
    }

    const user = await userService.getUserProfileById(userId);

    if (!user) {
      return res.status(404).json({ ok: false, error: "找不到使用者" });
    }

    res.json({ ok: true, data: user });
  } catch (error) {
    console.error("[getUserById] 錯誤:", error);
    res.status(500).json({ ok: false, error: "取得使用者資料失敗" });
  }
};

// module.exports = {
//   getMyProfile,
//   updateProfile,
//   updateUserInfo
// };