const Expense = require('../models/Expense');

//  IMPORT THE AUDIT LOGGER
const logAudit = require('../utils/auditLogger'); // Adjust path if needed

// 1. ADD
const addExpense = async (req, res) => {
  try {
    const { amount, category, vendor, paymentMethod, date } = req.body;
    const newExpense = new Expense({
      clinicId: req.user.clinicId,
      branchId: req.branchId, 
      recordedBy: req.user._id, 
      amount: Number(amount),
      category, vendor, paymentMethod,
      date: date || new Date()
    });
    
    await newExpense.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'ADD_EXPENSE', entity: 'Expense', entityId: newExpense._id,
      details: `Recorded new expense of ₹${amount} under category '${category}'${vendor ? ` to vendor ${vendor}` : ''}`
    });

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
      .populate('recordedBy', 'fullName name') 
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
        clinicId: req.user.clinicId 
      },
      req.body,
      { new: true }
    );
    
    if (!expense) return res.status(404).json({ message: 'Expense not found or unauthorized' });

    //  AUDIT LOG
    logAudit({
      req, action: 'UPDATE_EXPENSE', entity: 'Expense', entityId: expense._id,
      details: `Updated financial expense record (ID: ${expense._id})`
    });

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
      clinicId: req.user.clinicId 
    });
    
    if (!expense) return res.status(404).json({ message: 'Expense not found or unauthorized' });

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_EXPENSE', entity: 'Expense', entityId: expense._id,
      details: `Deleted expense record of ₹${expense.amount} under category '${expense.category}'`
    });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: 'Failed to delete' });
  }
};

module.exports = { addExpense, getExpenses, updateExpense, deleteExpense };