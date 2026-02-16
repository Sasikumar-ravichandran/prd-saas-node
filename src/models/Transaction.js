const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
	clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
	patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
	patientName: String, // Store snapshot of name for easier reporting
	amount: { type: Number, required: true },
	mode: { type: String, enum: ['Cash', 'UPI', 'Card'], default: 'Cash' },
	type: { type: String, enum: ['Payment', 'Refund'], default: 'Payment' },
	date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);