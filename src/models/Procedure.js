const mongoose = require('mongoose');

const ProcedureSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },

  // 1. Identification
  code: { type: String, required: true, uppercase: true, trim: true }, 
  name: { type: String, required: true, trim: true }, 

  // 2. Category (For Analytics)
  // CHANGED: Removed the strict Dental Enum so any specialty can create their own categories.
  category: { 
    type: String, 
    default: 'General'
  },

  // 3. Financials
  price: { type: Number, required: true, min: 0 }, 

  // CRITICAL: Keep this! 
  // This is the "Expense" attached to the work, regardless of who does it.
  labCost: { type: Number, default: 0 }, 

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Procedure', ProcedureSchema);