const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const mongoose = require('mongoose');

// @desc    Record a new payment
// @route   POST /api/payments
// @access  Private (Clinic Staff)
const addPayment = async (req, res) => {
    try {
        const { patientId, amount, method, transactionId, notes } = req.body;

        // 1. SECURITY: Validate Patient belongs to MY Clinic AND Active Branch
        const patient = await Patient.findOne({
            _id: patientId,
            clinicId: req.user.clinicId,
            branchId: req.branchId // <--- CRITICAL: Scope to Active Branch
        });

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found in this branch.' });
        }

        // 2. Create Receipt Number
        const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

        // 3. Create Payment Record
        const payment = await Payment.create({
            clinicId: req.user.clinicId,
            branchId: req.branchId, // <--- RECORD THE BRANCH
            patientId,
            amount: Number(amount),
            method,
            transactionId,
            receiptNumber,
            notes,
            recordedBy: req.user._id // Good for auditing who took the money
        });

        // 4. Update Patient Balance
        patient.totalPaid = (patient.totalPaid || 0) + Number(amount);
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

        // 1. SECURITY: Find Patient (Scoped to Branch)
        let query = { 
            clinicId: req.user.clinicId,
            branchId: req.branchId // <--- CRITICAL: Access Control
        };

        if (id.startsWith('PID-')) {
            query.patientId = id;
        } else if (mongoose.Types.ObjectId.isValid(id)) {
            query._id = id;
        } else {
            return res.status(400).json({ message: 'Invalid Patient ID' });
        }

        const patient = await Patient.findOne(query);

        if (!patient) return res.status(404).json({ message: 'Patient not found in this branch' });

        // 2. GET PAYMENTS
        // Note: We fetch ALL payments for this patient ID within the clinic.
        // Even if they paid at a different branch previously (if you allow transfers),
        // the ledger should show the full financial history.
        const payments = await Payment.find({
            patientId: patient._id,
            clinicId: req.user.clinicId
        }).sort({ createdAt: -1 });

        // 3. MERGE & FORMAT

        // A. Format Treatments (Debits)
        const debits = (patient.treatmentPlan || [])
            .filter(t => t.status === 'In Progress' || t.status === 'Completed')
            .map(t => ({
                _id: t._id,
                date: t.updatedAt || new Date(),
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