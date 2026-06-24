const express = require('express');
const router = express.Router();
const { 
  addExpense, 
  getExpenses, 
  updateExpense, 
  deleteExpense 
} = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware'); // Or wherever your auth is

// Apply protection to all expense routes
router.use(protect);

router.route('/')
  .post(addExpense)
  .get(getExpenses);

router.route('/:id')
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;