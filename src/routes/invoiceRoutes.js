const express = require('express');
const router = express.Router();
const { createInvoice } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createInvoice);

module.exports = router;