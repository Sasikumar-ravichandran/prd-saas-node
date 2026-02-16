const Expense = require('../models/Expense');

// @desc    Add a new expense
// @route   POST /api/expenses
const addExpense = async (req, res) => {
  try {
    const { title, category, amount, paymentMethod, vendor, date, notes } = req.body;

    const expense = await Expense.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId, // <--- CRITICAL: Tag Expense to Active Branch
      title,
      category,
      amount: Number(amount),
      paymentMethod,
      vendor,
      date: date || new Date(),
      notes,
      recordedBy: req.user._id
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error("Expense Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all expenses (filtered by Branch)
// @route   GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ 
        clinicId: req.user.clinicId,
        branchId: req.branchId // <--- FILTER: Only show expenses for this location
    })
    .sort({ date: -1 });
    
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { addExpense, getExpenses };