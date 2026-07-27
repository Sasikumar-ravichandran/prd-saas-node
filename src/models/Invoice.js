const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },

  //  PRIMARY DOCTOR (Useful for the commission reports)
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  invoiceNumber: { type: String, required: true }, // e.g., INV-001

  //  THE PROCEDURES BEING BILLED
  items: [{
    treatmentId: { type: String }, // Link to patient.treatmentPlan._id
    procedureName: { type: String, required: true },
    cost: { type: Number, required: true },
    discount: { type: Number, default: 0 },

    // 💰 SNAPSHOT: Save the commission amount here when creating invoice
    // This ensures historical reports don't change if you change the doctor's % later.
    doctorCommissionAmount: { type: Number, default: 0 }
  }],

  // Financials
  totalAmount: { type: Number, required: true }, // Sum of items cost
  discount: { type: Number, default: 0 },        // Global discount
  finalAmount: { type: Number, required: true }, // Total - Discount

  paidAmount: { type: Number, default: 0 },      // Starts at 0, increases with Payments
  balance: { type: Number },                     // finalAmount - paidAmount



  dueDate: { type: Date },
  notes: String,
  status: {
    type: String,
    enum: ['Unpaid', 'Partial', 'Paid', 'Void'],
    default: 'Unpaid'
  },

}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);