const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const mongoose = require('mongoose');

// @desc    Record a new payment
// @route   POST /api/payments
// @access  Private (Clinic Staff)
const addPayment = async (req, res) => {
	try {
		const { patientId, amount, method, transactionId, notes } = req.body;

		// 1. SECURITY: Validate Patient belongs to MY Clinic
		// We combine the ID check with the clinicId check.
		const patient = await Patient.findOne({
			_id: patientId,
			clinicId: req.user.clinicId // <--- CRITICAL FILTER
		});

		if (!patient) {
			return res.status(404).json({ message: 'Patient not found or access denied.' });
		}

		// 2. Create Receipt Number
		const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

		// 3. Create Payment Record (Tag with Clinic ID)
		const payment = await Payment.create({
			clinicId: req.user.clinicId, // <--- BIND TO CLINIC
			patientId,
			amount: Number(amount),
			method,
			transactionId,
			receiptNumber,
			notes
		});

		// 4. Update Patient Balance
		// (This logic remains valid because we already verified the patient owns this record)
		patient.totalPaid = (patient.totalPaid || 0) + Number(amount);

		// Recalculate Balance: Total Cost (Treatments) - Total Paid
		patient.walletBalance = (patient.totalCost || 0) - patient.totalPaid;

		await patient.save();

		res.status(201).json({ payment, updatedPatient: patient });

	} catch (error) {
		console.error("Payment Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

// @desc    Get Ledger (Merged Treatments + Payments)
// @route   GET /api/patients/:id/ledger
// @access  Private
const getPatientLedger = async (req, res) => {
	try {

		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}

		const { id } = req.params;

		// 1. SECURITY: Find Patient (Handle PID vs MongoID)
		let query = { clinicId: req.user.clinicId };

		if (id.startsWith('PID-')) {
			query.patientId = id;
		} else if (mongoose.Types.ObjectId.isValid(id)) {
			query._id = id;
		} else {
			return res.status(400).json({ message: 'Invalid Patient ID' });
		}

		const patient = await Patient.findOne(query);

		if (!patient) return res.status(404).json({ message: 'Patient not found' });

		// 2. SECURITY: Get Payments (Scoped to Clinic)
		// We ensure we only fetch payments that belong to this clinic AND this patient
		const payments = await Payment.find({
			patientId: patient._id, // Use the resolved MongoID from step 1
			clinicId: req.user.clinicId
		}).sort({ createdAt: -1 });

		// 3. MERGE & FORMAT (Logic unchanged)

		// A. Format Treatments (Debits)
		// We format specific fields for the frontend Ledger Table
		const debits = (patient.treatmentPlan || [])
			.filter(t => t.status === 'In Progress' || t.status === 'Completed')
			.map(t => ({
				_id: t._id,
				date: t.updatedAt || new Date(), // Use update time as transaction time
				description: t.procedure,
				type: 'DEBIT',
				amount: t.cost,
				tooth: t.tooth
			}));

		// B. Format Payments (Credits)
		const credits = payments.map(p => ({
			_id: p._id,
			date: p.createdAt,
			description: `Payment via ${p.method}`,
			type: 'CREDIT',
			amount: p.amount,
			receiptNumber: p.receiptNumber
		}));

		// C. Combine & Sort (Newest on Top)
		const ledger = [...debits, ...credits].sort((a, b) => new Date(b.date) - new Date(a.date));

		res.json(ledger);

	} catch (error) {
		console.error("Ledger Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

module.exports = { addPayment, getPatientLedger };