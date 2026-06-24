// routes/payrollRoutes.js
const express = require('express');
const router = express.Router();
const { getPayrollReport } = require('../controllers/payrollController');
const { protect } = require('../middleware/authMiddleware');

// The line 6 that is crashing:
router.get('/', protect, getPayrollReport);

module.exports = router;