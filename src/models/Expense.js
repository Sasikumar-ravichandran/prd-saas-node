const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  category: { 
    type: String, 
    enum: ['Office Supplies', 'Rent', 'Utilities', 'Salaries', 'Marketing', 'Dental Materials', 'Maintenance', 'Other'],
    required: true 
  },
  amount: { type: Number, required: true },
  
  paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'UPI', 'Card'], default: 'Bank Transfer' },
  vendor: { type: String }, // e.g., "Dental Depot" or "Landlord"
  
  date: { type: Date, default: Date.now },
  notes: String,
  
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Who added this expense?
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);