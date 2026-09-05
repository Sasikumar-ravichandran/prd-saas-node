const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const Drug = require('../models/Drug');

//  IMPORT THE AUDIT LOGGER
const logAudit = require('../utils/auditLogger'); // Adjust path if needed

// 1. Define getDrugs
const getDrugs = async (req, res) => {
  try {
    const drugs = await Drug.find({ clinicId: req.user.clinicId }).sort({ name: 1 });
    res.json(drugs);
  } catch (error) {
    console.error("Get Drugs Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// 2. Define createPrescription
const createPrescription = async (req, res) => {
  try {
    let { patientId, doctorId, medications, notes, appointmentId } = req.body;

    // SAFE PARSING
    if (typeof medications === 'string') {
      try {
        const sanitized = medications.replace(/'/g, '"');
        medications = JSON.parse(sanitized);
      } catch (e) {
        return res.status(400).json({
          message: "Medications must be a valid Array. Received a malformed string."
        });
      }
    }

    // VALIDATION: Ensure it's now a clean array
    if (!Array.isArray(medications)) {
      return res.status(400).json({ message: "Medications must be an array of objects." });
    }

    const prescription = await Prescription.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId || req.user.defaultBranch,
      patientId,
      doctorId: doctorId || req.user._id,
      appointmentId: (appointmentId && mongoose.isValidObjectId(appointmentId)) ? appointmentId : null,
      medications, 
      notes
    });

    //  AUDIT LOG
    logAudit({
      req, 
      action: 'CREATE_PRESCRIPTION', 
      entity: 'Prescription', 
      entityId: prescription._id,
      details: `Created medical prescription with ${medications.length} medication(s)`
    });

    res.status(201).json(prescription);
  } catch (error) {
    console.error("Prescription Create Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// 3. Define getPatientPrescriptions
const getPatientPrescriptions = async (req, res) => {
  try {
    const history = await Prescription.find({
      patientId: req.params.patientId,
      clinicId: req.user.clinicId
    })
      .populate('doctorId', 'fullName role') 
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({ message: 'Error fetching history' });
  }
};

// 4. Define deletePrescription
const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const presId = prescription._id;
    await prescription.deleteOne();

    //  AUDIT LOG
    logAudit({
      req, 
      action: 'DELETE_PRESCRIPTION', 
      entity: 'Prescription', 
      entityId: presId,
      details: `Permanently deleted medical prescription record`
    });

    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    console.error("Delete Prescription Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { medications, notes } = req.body;

    const prescription = await Prescription.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId },
      { medications, notes },
      { new: true, runValidators: true }
    );

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    //  AUDIT LOG
    logAudit({
      req, 
      action: 'UPDATE_PRESCRIPTION', 
      entity: 'Prescription', 
      entityId: prescription._id,
      details: `Updated medical prescription record`
    });

    res.json(prescription);
  } catch (error) {
    console.error("Error updating prescription:", error);
    res.status(500).json({ message: 'Error updating prescription' });
  }
};

// 5. Export everything together
module.exports = {
  getDrugs,
  createPrescription,
  getPatientPrescriptions,
  deletePrescription,
  updatePrescription
};