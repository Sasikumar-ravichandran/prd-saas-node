const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createInvoice, getInvoices, getInvoiceById, recordPayment, voidInvoice } = require('../controllers/invoiceController');

router.use(protect);

router.route('/')
  .post(createInvoice)
  .get(getInvoices);

router.route('/:id')
  .get(getInvoiceById)
  .delete(voidInvoice);

router.post('/:id/pay', recordPayment);
router.put('/:id/void', protect, voidInvoice);

module.exports = router;