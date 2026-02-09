const express = require('express');
const router = express.Router();
const { addPayment, getPatientLedger } = require('../controllers/paymentController');

// Route to add money
router.post('/', addPayment);

// Route to get the history (We attach this to payment route for convenience)
router.get('/ledger/:id', getPatientLedger);

module.exports = router;