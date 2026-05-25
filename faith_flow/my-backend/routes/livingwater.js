const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');

const {
  generateLetterController,
  generateImageController,
  getDailyCardController,
  getWeeklyCardsController,
  recordDrawController,
  completeDrawController,
  getMyDrawsController,
  getMyCollectionController,
  getDrawController,
  chatController,
} = require('../controllers/livingwatercontroller');

// 不需要登入
router.get('/daily-card', getDailyCardController);
router.get('/weekly-cards', getWeeklyCardsController);

// 需要登入
router.get('/my-draws', verifyToken, attachUserId, getMyDrawsController);
router.get('/my-collection', verifyToken, attachUserId, getMyCollectionController);
router.post('/record-draw', verifyToken, attachUserId, recordDrawController);
router.post('/complete-draw', verifyToken, attachUserId, completeDrawController);
router.post('/generate-letter', generateLetterController);
router.post('/generate-image', generateImageController);
router.get('/draw/:user_draws_id', verifyToken, attachUserId, getDrawController);
router.post('/chat', verifyToken, attachUserId, chatController);


module.exports = router;