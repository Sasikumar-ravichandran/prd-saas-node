const express = require('express');
const router = express.Router();
const { getReceptionStats, getDoctorStats, getAdminStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/reception', protect, getReceptionStats);
router.get('/doctor', protect, getDoctorStats);
router.get('/admin', protect, getAdminStats);

module.exports = router;