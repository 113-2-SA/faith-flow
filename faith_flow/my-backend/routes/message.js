const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messagecontroller');
const { verifyToken } = require('../middleware/auth');

// 訊息相關
router.get('/conversations/:conversation_id/messages', verifyToken, messageController.list);
router.post('/conversations/:conversation_id/messages', verifyToken, messageController.send);
router.delete('/messages/:id', verifyToken, messageController.delete);

module.exports = router;