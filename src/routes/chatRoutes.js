const express = require('express');
const router = express.Router();
const { accessPrivateChat, fetchChats, createGroupChat } = require('../controllers/chatController'); //  ADD createGroupChat here
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, accessPrivateChat).get(protect, fetchChats);
router.route('/group').post(protect, createGroupChat);

module.exports = router;