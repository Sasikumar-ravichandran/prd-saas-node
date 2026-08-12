const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },

  // PRIMARY DOCTOR (Useful for the commission reports)
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  invoiceNumber: { type: String, required: true }, 

  // THE PROCEDURES BEING BILLED
  items: [{
    treatmentId: { type: String }, 
    procedureName: { type: String, required: true },
    cost: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    labCostDeducted: { type: Number, default: 0 },
    doctorCommissionAmount: { type: Number, default: 0 }
  }],

  // Financials
  totalAmount: { type: Number, required: true }, 
  discount: { type: Number, default: 0 },        
  finalAmount: { type: Number, required: true }, 

  paidAmount: { type: Number, default: 0 },      
  balance: { type: Number },                     

  dueDate: { type: Date },
  notes: String,
  status: {
    type: String,
    enum: ['Unpaid', 'Partial', 'Paid', 'Void'],
    default: 'Unpaid'
  },

}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);