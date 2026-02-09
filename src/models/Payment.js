const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({

	clinicId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Clinic',
		required: true,
		index: true // Index for fast filtering
	},

	// Link to the Patient
	patientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Patient',
		required: true
	},

	// Payment Details
	amount: { type: Number, required: true },
	method: {
		type: String,
		enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance'],
		default: 'Cash'
	},

	transactionId: { type: String }, // e.g., UPI Ref Number

	date: { type: Date, default: Date.now },

	// Receipt Number (Auto-generated usually, simplified here)
	receiptNumber: { type: String },

	notes: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);