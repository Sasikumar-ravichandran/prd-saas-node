const Payment = require('../models/Payment');
const Patient = require('../models/Patient');

// @desc    Record a new payment
// @route   POST /api/payments
const addPayment = async (req, res) => {
  try {
    const { patientId, amount, method, transactionId, notes } = req.body;

    // 1. Validate Patient
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Create Receipt Number (Simple Timestamp based)
    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

    // 3. Create Payment Record
    const payment = await Payment.create({
      patientId,
      amount: Number(amount),
      method,
      transactionId,
      receiptNumber,
      notes
    });

    // 4. CRITICAL: Update Patient Balance
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
const getPatientLedger = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get Patient (for Treatments)
    // Note: If you use PID-1001, use the findOne logic here like before
    const patient = await Patient.findById(id); 
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Get Payments
    const payments = await Payment.find({ patientId: id }).sort({ date: -1 });

    // 3. MERGE & FORMAT DATA
    // We want a single list of events: "Treatment Done" or "Payment Received"
    
    // A. Format Treatments (Debits)
    const debits = patient.treatmentPlan
      .filter(t => t.status === 'In Progress' || t.status === 'Completed')
      .map(t => ({
        _id: t._id,
        date: t.date,
        description: t.procedure, // e.g., "Root Canal"
        type: 'DEBIT',            // Patient owes this
        amount: t.cost,
        tooth: t.tooth
      }));

    // B. Format Payments (Credits)
    const credits = payments.map(p => ({
      _id: p._id,
      date: p.date,
      description: `Payment via ${p.method}`,
      type: 'CREDIT',           // Patient paid this
      amount: p.amount,
      receiptNumber: p.receiptNumber
    }));

    // C. Combine and Sort by Date (Newest First)
    const ledger = [...debits, ...credits].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(ledger);

  } catch (error) {
    console.error("Ledger Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { addPayment, getPatientLedger };