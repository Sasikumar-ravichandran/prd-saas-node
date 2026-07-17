const express = require('express');
const router = express.Router();
const { sendMessage, allMessages, getUnreadCount } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, sendMessage);
router.route('/unread-count').get(protect, getUnreadCount);
router.route('/:chatId').get(protect, allMessages);

module.exports = router;