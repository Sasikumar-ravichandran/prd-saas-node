const mongoose = require('mongoose');

const ProcedureSchema = new mongoose.Schema({
  // Unique Code (e.g., RCT-01) - Great for quick lookup
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  
  name: { type: String, required: true, trim: true },
  
  price: { type: Number, required: true, min: 0 },
  
  // Tax Percentage (GST/VAT)
//   tax: { type: Number, default: 0, min: 0 },
  
  // Doctor Commission Percentage (0-100%)
  commission: { type: Number, default: 0, min: 0, max: 100 },
  
  // Estimated Lab Cost (Internal Reference)
//   labCost: { type: Number, default: 0 },
  
  // Is this procedure currently offered?
  isActive: { type: Boolean, default: true },

  // Link to Clinic (for multi-tenancy later)
  // clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' }

}, { timestamps: true });

module.exports = mongoose.model('Procedure', ProcedureSchema);