// ==================== routes/auth.js ====================
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authcontroller");

router.post("/sync", authController.syncUser);
router.post("/import-firebase-users", authController.importFirebaseUsers);

module.exports = router;