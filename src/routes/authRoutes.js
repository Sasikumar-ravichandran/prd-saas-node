const express = require('express');
const router = express.Router();
const {
  sendOtp,
  registerClinic,
  loginUser,
  changePassword,
  resetPasswordWithOtp,
  verifyOtp
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware'); // your existing auth middleware

// Public Routes
router.post('/send-otp', sendOtp);
router.post('/register', registerClinic);
router.post('/login', loginUser);
router.post('/request-otp', resetPasswordWithOtp);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPasswordWithOtp);

// Protected Routes
router.put('/password', protect, changePassword);

module.exports = router;