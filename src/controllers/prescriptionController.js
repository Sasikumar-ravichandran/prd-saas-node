const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const Drug = require('../models/Drug');

// ⚡️ 1. Define getDrugs (Make sure this exists!)
const getDrugs = async (req, res) => {
  try {
    const drugs = await Drug.find({ clinicId: req.user.clinicId }).sort({ name: 1 });
    res.json(drugs);
  } catch (error) {
    console.error("Get Drugs Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ⚡️ 2. Define createPrescription
const createPrescription = async (req, res) => {
  try {
    let { patientId, doctorId, medications, notes, appointmentId } = req.body;

    // 🕵️ DEBUG: Log exactly what the server sees
    console.log("Medications Type:", typeof medications);
    console.log("Medications Value:", medications);

    // ⚡️ SAFE PARSING
    if (typeof medications === 'string') {
      try {
        // If it's a string, it must be valid JSON. 
        // We replace single quotes with double quotes just in case.
        const sanitized = medications.replace(/'/g, '"');
        medications = JSON.parse(sanitized);
      } catch (e) {
        return res.status(400).json({
          message: "Medications must be a valid Array. Received a malformed string."
        });
      }
    }

    // 🛡️ VALIDATION: Ensure it's now a clean array
    if (!Array.isArray(medications)) {
      return res.status(400).json({ message: "Medications must be an array of objects." });
    }

    const prescription = await Prescription.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId || req.user.defaultBranch,
      patientId,
      doctorId: doctorId || req.user._id,
      appointmentId: (appointmentId && mongoose.isValidObjectId(appointmentId)) ? appointmentId : null,
      medications, // Pass the array directly
      notes
    });

    res.status(201).json(prescription);
  } catch (error) {
    console.error("Prescription Create Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ⚡️ 3. Define getPatientPrescriptions
const getPatientPrescriptions = async (req, res) => {
  try {
    const history = await Prescription.find({
      patientId: req.params.patientId,
      clinicId: req.user.clinicId
    })
      .populate('doctorId', 'fullName role') // Using fullName from your User model
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history' });
  }
};

// ⚡️ 4. Define deletePrescription
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

    await prescription.deleteOne();
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

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: 'Error updating prescription' });
  }
};

// ⚡️ 5. Now Export everything together
module.exports = {
  getDrugs,
  createPrescription,
  getPatientPrescriptions,
  deletePrescription,
  updatePrescription
};