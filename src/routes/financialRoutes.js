const express = require('express');
const router = express.Router();
const { getMasterLedger } = require('../controllers/financialController');
const { protect } = require('../middleware/authMiddleware'); // Assuming you have auth middleware

// Use the 'protect' middleware to ensure only logged-in users see financials
router.get('/ledger', protect, getMasterLedger);

module.exports = router;