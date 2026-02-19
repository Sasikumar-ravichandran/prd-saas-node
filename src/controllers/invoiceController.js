const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Patient = require('../models/Patient');

// @desc    Create a new Invoice (and freeze doctor commission)
// @route   POST /api/invoices
// @access  Private (Receptionist/Admin)
const createInvoice = async (req, res) => {
  try {
    const { 
      patientId, 
      doctorId, 
      items,       // Array of { procedureName, cost, treatmentId }
      discount, 
      notes,
      dueDate 
    } = req.body;

    // 1. Fetch the Doctor to get CURRENT Commission Rate
    // We need to know who did the work to calculate their cut.
    const doctor = await User.findById(doctorId).select('doctorConfig fullName');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Default to 0 if not set
    const commissionRate = doctor.doctorConfig?.commissionPercentage || 0; 

    // 2. Process Items & Calculate Commission Snapshot
    let totalAmount = 0;

    const processedItems = items.map(item => {
      const itemCost = Number(item.cost);
      totalAmount += itemCost;

      // 💰 CORE LOGIC: Calculate Commission NOW
      const commissionAmount = (itemCost * commissionRate) / 100;

      return {
        treatmentId: item.treatmentId, // Link to patient treatment plan
        procedureName: item.procedureName,
        cost: itemCost,
        // Save the calculated amount, NOT just the percentage
        doctorCommissionAmount: commissionAmount 
      };
    });

    // 3. Calculate Finals
    const finalDiscount = Number(discount) || 0;
    const finalAmount = totalAmount - finalDiscount;

    // 4. Generate Invoice Number (Simple Timestamp version)
    // In a real app, you might want a counter like INV-2026-001
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // 5. Create the Invoice
    const invoice = await Invoice.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId || req.user.defaultBranch,
      patientId,
      doctorId,
      invoiceNumber,
      items: processedItems,
      totalAmount,
      discount: finalDiscount,
      finalAmount,
      balance: finalAmount, // Initially, balance = total amount
      status: 'Unpaid',     // Default status
      dueDate: dueDate || new Date(),
      notes
    });

    // 6. Optional: Mark Treatments as "Billed" in Patient Model
    // If you want to prevent billing the same treatment twice:
    if (items.length > 0) {
      await Patient.updateOne(
        { _id: patientId, "treatmentPlan._id": { $in: items.map(i => i.treatmentId) } },
        { $set: { "treatmentPlan.$[elem].billed": true } },
        { arrayFilters: [{ "elem._id": { $in: items.map(i => i.treatmentId) } }] }
      );
    }

    res.status(201).json(invoice);

  } catch (error) {
    console.error("Create Invoice Error:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = { createInvoice };