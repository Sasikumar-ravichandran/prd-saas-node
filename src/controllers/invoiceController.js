const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Patient = require('../models/Patient');
// NEW: Import Procedure to fetch lab costs
const Procedure = require('../models/Procedure'); 
const mongoose = require('mongoose');

// @desc    Create an Invoice
// @route   POST /api/invoices
// @access  Private (Receptionist/Admin)
const createInvoice = async (req, res) => {
  try {
    const { patientId, doctorId, items, discount, notes, dueDate } = req.body;

    // 1. BULLETPROOF DOCTOR RESOLUTION
    let doctor = null;
    let actualDoctorId = null;

    if (doctorId) {
      if (mongoose.Types.ObjectId.isValid(doctorId)) {
        doctor = await User.findById(doctorId);
      } else {
        doctor = await User.findOne({ fullName: doctorId, clinicId: req.user.clinicId });
      }
    }

    if (!doctor) {
      return res.status(400).json({
        message: `Could not find a valid doctor record for "${doctorId}". Please ensure the doctor exists.`
      });
    }

    actualDoctorId = doctor._id;
    const commissionRate = doctor.doctorConfig?.commissionPercentage || 0;

    // 2. Process Items & Calculate Commission WITH LAB COST DEDUCTION
    let totalAmount = 0;
    
    // We use Promise.all because we need to query the database for every item
    const processedItems = await Promise.all(items.map(async (item) => {
      const itemCost = Number(item.cost);
      totalAmount += itemCost;

      // Fetch the Procedure to check if it has a Lab Cost
      const procedureRecord = await Procedure.findOne({ 
        name: item.procedureName, 
        clinicId: req.user.clinicId 
      });

      const labCost = procedureRecord ? procedureRecord.labCost : 0;
      
      // The New Math: (Patient Cost - Lab Cost) * Commission %
      const netProfit = Math.max(0, itemCost - labCost); // Ensure it doesn't go negative
      const calculatedCommission = (netProfit * commissionRate) / 100;

      return {
        treatmentId: item.treatmentId,
        procedureName: item.procedureName,
        cost: itemCost,
        labCostDeducted: labCost, // Record the lab cost used
        doctorCommissionAmount: calculatedCommission // Save the accurate commission
      };
    }));

    // 3. Calculate Finals
    const finalDiscount = Number(discount) || 0;
    const finalAmount = totalAmount - finalDiscount;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // 4. Create the Invoice
    const invoice = await Invoice.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId || req.user.defaultBranch,
      patientId,
      doctorId: actualDoctorId, 
      invoiceNumber,
      items: processedItems,
      totalAmount,
      discount: finalDiscount,
      finalAmount,
      balance: finalAmount,
      status: 'Unpaid',
      dueDate: dueDate || new Date(),
      notes
    });

    // 5. Mark Treatments as "Billed" in Patient Model
    if (items.length > 0) {
      const treatmentObjectIds = items.map(i => new mongoose.Types.ObjectId(i.treatmentId));

      await Patient.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(patientId) },
        { $set: { "treatmentPlan.$[elem].billed": true } },
        { arrayFilters: [{ "elem._id": { $in: treatmentObjectIds } }] }
      );
    }

    res.status(201).json(invoice);

  } catch (error) {
    console.error("Create Invoice Error:", error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      clinicId: req.user.clinicId,
      branchId: req.branchId || req.user.defaultBranch
    })
      .populate('patientId', 'fullName patientId mobile')
      .populate('doctorId', 'fullName')
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      clinicId: req.user.clinicId
    })
      .populate('patientId', 'fullName patientId mobile age gender')
      .populate('doctorId', 'fullName');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const voidInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, clinicId: req.user.clinicId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    if (invoice.items && invoice.items.length > 0) {
      const treatmentObjectIds = invoice.items.map(i => new mongoose.Types.ObjectId(i.treatmentId));
      
      await Patient.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(invoice.patientId) },
        { $set: { "treatmentPlan.$[elem].billed": false } }, 
        { arrayFilters: [{ "elem._id": { $in: treatmentObjectIds } }] }
      );
    }

    invoice.status = 'Void';
    invoice.balance = 0;
    await invoice.save();

    res.json({ message: 'Invoice voided successfully', invoice });
  } catch (error) {
    console.error("Void Invoice Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, reference } = req.body;
    const paymentAmount = Number(amount);

    const invoice = await Invoice.findOne({ _id: req.params.id, clinicId: req.user.clinicId });
    
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'Void') return res.status(400).json({ message: 'Cannot pay a voided invoice' });
    if (paymentAmount <= 0) return res.status(400).json({ message: 'Payment must be greater than zero' });
    if (paymentAmount > invoice.balance) {
      return res.status(400).json({ message: `Cannot overpay. Balance due is ₹${invoice.balance}` });
    }

    if (!invoice.payments) {
      invoice.payments = [];
    }

    invoice.payments.push({
      amount: paymentAmount,
      method: paymentMethod,
      reference: reference || '',
      date: new Date(),
      recordedBy: req.user._id
    });

    invoice.balance -= paymentAmount;

    if (invoice.balance === 0) {
      invoice.status = 'Paid';
    } else if (invoice.balance > 0) {
      invoice.status = 'Partial';
    }

    await invoice.save();
    
    res.json({ message: 'Payment recorded successfully', invoice });

  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { createInvoice, getInvoices, getInvoiceById, voidInvoice, recordPayment };