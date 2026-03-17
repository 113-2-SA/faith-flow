const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationcontroller');

// 🆕 統計必須放在 /:id 之前，否則會被當成 id
router.get('/stats', conversationController.stats);

// 對話 CRUD
router.post('/', conversationController.create);
router.get('/', conversationController.list);
router.get('/:id', conversationController.getOne);
router.patch('/:id', conversationController.update);
router.delete('/:id', conversationController.delete);

module.exports = router;