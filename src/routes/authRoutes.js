const express = require('express');
const router = express.Router();
const { registerClinic, loginUser, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerClinic);
router.post('/login', loginUser);
router.put('/change-password', protect, changePassword);

module.exports = router;