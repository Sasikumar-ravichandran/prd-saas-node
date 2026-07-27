const Expense = require('../models/Expense');

// 1. ADD
const addExpense = async (req, res) => {
  try {
    const { amount, category, vendor, paymentMethod, date } = req.body;
    const newExpense = new Expense({
      clinicId: req.user.clinicId,
      branchId: req.branchId, 
      recordedBy: req.user._id, // FIXED: Matches your schema
      amount: Number(amount),
      category, vendor, paymentMethod,
      date: date || new Date()
    });
    await newExpense.save();
    res.status(201).json({ message: 'Expense added', expense: newExpense });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add expense', details: error.message });
  }
};

// 2. GET
const getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = { clinicId: req.user.clinicId, branchId: req.branchId };

    if (startDate && endDate) {
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    if (category && category !== 'All Categories') query.category = category;

    const expenses = await Expense.find(query)
      .populate('recordedBy', 'fullName name') //FIXED: Matches your schema
      .sort({ date: -1 });
      
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    res.json({ expenses, totalAmount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expenses' });
  }
};

// 3. UPDATE
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { 
        _id: req.params.id, 
        clinicId: req.user.clinicId //  REMOVED branchId completely
      },
      req.body,
      { new: true }
    );
    
    if (!expense) return res.status(404).json({ message: 'Expense not found or unauthorized' });
    res.json({ message: 'Updated successfully', expense });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ message: 'Failed to update' });
  }
};

// 4. DELETE
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ 
      _id: req.params.id, 
      clinicId: req.user.clinicId //  REMOVED branchId completely
    });
    
    if (!expense) return res.status(404).json({ message: 'Expense not found or unauthorized' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: 'Failed to delete' });
  }
};

module.exports = { addExpense, getExpenses, updateExpense, deleteExpense };