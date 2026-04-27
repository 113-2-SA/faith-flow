const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationcontroller');
const { verifyToken } = require('../middleware/auth');

// 🔄 所有路由都加上 verifyFirebaseToken
router.post('/', verifyToken, conversationController.create);
router.get('/', verifyToken, conversationController.list);
router.get('/:id', verifyToken, conversationController.getOne);
router.patch('/:id', verifyToken, conversationController.update);
router.delete('/:id', verifyToken, conversationController.delete);

module.exports = router;