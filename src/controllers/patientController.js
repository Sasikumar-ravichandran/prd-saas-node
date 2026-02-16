const Patient = require('../models/Patient');
const mongoose = require('mongoose');

// @desc    Create a new patient
// @route   POST /api/patients
// @access  Private (Clinic Staff Only)
const createPatient = async (req, res) => {
  try {
    const {
      fullName, age, gender, mobile, bloodGroup,
      emergencyContact, emergencyRelation,
      assignedDoctor, referredBy, communication,
      primaryConcern, painLevel, medicalConditions, notes,
      attachments
    } = req.body;

    if (!fullName || !mobile || !assignedDoctor) {
      return res.status(400).json({ message: 'Name, Mobile, and Doctor are required.' });
    }

    // --- ID GENERATION LOGIC ---
    // Note: We search the entire CLINIC (all branches) for the last ID.
    // This ensures PID-1001 is unique across the whole company, avoiding duplicates if branches merge.
    const lastPatient = await Patient.findOne({ clinicId: req.user.clinicId })
      .sort({ patientId: -1 })
      .collation({ locale: "en_US", numericOrdering: true });

    let nextId = 1001;

    if (lastPatient && lastPatient.patientId) {
      const lastIdStr = lastPatient.patientId.replace('PID-', '');
      const lastIdNum = parseInt(lastIdStr);
      if (!isNaN(lastIdNum)) {
        nextId = lastIdNum + 1;
      }
    }

    const patientId = `PID-${nextId}`;

    // --- CREATE PATIENT ---
    const patient = await Patient.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId, // <--- CRITICAL: Assign to Active Branch
      patientId,
      fullName,
      age,
      gender,
      mobile,
      bloodGroup,
      emergencyContact,
      emergencyRelation,
      assignedDoctor,
      referredBy,
      communication,
      primaryConcern,
      painLevel,
      medicalConditions,
      notes,
      attachments
    });

    res.status(201).json({
      _id: patient._id,
      patientId: patient.patientId,
      fullName: patient.fullName,
      branchId: patient.branchId,
      message: 'Patient registered successfully!'
    });

  } catch (error) {
    console.error("Error creating patient:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Error generating ID. Please try again.' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete patient
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Construct Secure Query (Clinic + Branch)
    let query = {
      clinicId: req.user.clinicId,
      branchId: req.branchId // <--- LOCK DELETE TO BRANCH
    };

    if (id.startsWith('PID-')) {
      query.patientId = id;
    } else {
      query._id = id;
    }

    const patient = await Patient.findOne(query);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or access denied' });
    }

    await patient.deleteOne();

    res.json({ message: 'Patient record deleted successfully' });

  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all patients (Scoped to Active Branch)
// @route   GET /api/patients
// @access  Private
const getPatients = async (req, res) => {
  try {
    if (!req.user || !req.user.clinicId) {
      return res.json([]);
    }

    // SECURITY: Only find patients belonging to MY clinic AND Active Branch
    const patients = await Patient.find({
      isActive: true,
      clinicId: req.user.clinicId,
      branchId: req.branchId // <--- FILTER BY BRANCH
    }).sort({ createdAt: -1 });

    res.json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single patient by ID (Secure)
// @route   GET /api/patients/:id
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    // Base Security Filter: Clinic + Branch
    let query = {
      clinicId: req.user.clinicId,
      branchId: req.branchId
    };

    if (id.startsWith('PID-')) {
      query.patientId = id;
    } else if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      return res.status(400).json({ message: 'Invalid Patient ID format' });
    }

    // Only returns if Matches Clinic AND Branch
    const patient = await Patient.findOne(query);

    if (patient) {
      res.json(patient);
    } else {
      res.status(404).json({ message: 'Patient not found in this branch' });
    }

  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add Treatment (Secure)
const addTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const { tooth, procedure, cost, status } = req.body;

    let query = {
      clinicId: req.user.clinicId,
      branchId: req.branchId
    };
    if (id.startsWith('PID-')) query.patientId = id;
    else query._id = id;

    const patient = await Patient.findOne(query);

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const newTreatment = {
      tooth,
      procedure,
      cost: Number(cost),
      status: status || 'Proposed'
    };
    patient.treatmentPlan.push(newTreatment);

    if (status === 'In Progress' || status === 'Completed') {
      patient.totalCost = (patient.totalCost || 0) + newTreatment.cost;
      patient.walletBalance = patient.totalCost - (patient.totalPaid || 0);
    }

    await patient.save();
    res.status(201).json(patient);

  } catch (error) {
    console.error("Error adding treatment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Start Treatment (Secure)
const startTreatment = async (req, res) => {
  try {
    const { id } = req.params;

    let query = {
      clinicId: req.user.clinicId,
      branchId: req.branchId
    };
    if (id.startsWith('PID-')) query.patientId = id;
    else query._id = id;

    const patient = await Patient.findOne(query);

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const proposedItems = patient.treatmentPlan.filter(item => item.status === 'Proposed');

    if (proposedItems.length === 0) {
      return res.status(400).json({ message: 'No proposed treatments to start.' });
    }

    let addedCost = 0;
    patient.treatmentPlan.forEach(item => {
      if (item.status === 'Proposed') {
        item.status = 'In Progress';
        addedCost += item.cost;
      }
    });

    patient.totalCost = (patient.totalCost || 0) + addedCost;
    patient.walletBalance = patient.totalCost - (patient.totalPaid || 0);

    await patient.save();

    res.json({
      message: `${proposedItems.length} treatments started`,
      patient
    });

  } catch (error) {
    console.error("Error starting treatment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update Treatment Status (Secure)
const updateTreatmentStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status } = req.body;

    const patient = await Patient.findOne({
      patientId: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId // <--- CRITICAL
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const treatment = patient.treatmentPlan.id(itemId);
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment item not found' });
    }

    treatment.status = status;

    if (status === 'Proposed') {
      treatment.completedDate = undefined;
    } else if (status === 'Completed') {
      treatment.completedDate = new Date();
    }
    recalculateTotalCost(patient);
    await patient.save();
    res.json(patient);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const recalculateTotalCost = (patient) => {
  patient.totalCost = patient.treatmentPlan.reduce((total, item) => {
    if (item.status === 'Completed' || item.status === 'In Progress') {
      return total + (item.cost || 0);
    }
    return total;
  }, 0);
};

// @desc    Delete Treatment (Secure)
const deleteTreatment = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const patient = await Patient.findOne({
      patientId: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId // <--- CRITICAL
    });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const treatment = patient.treatmentPlan.id(itemId);
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment item not found' });
    }

    patient.treatmentPlan.pull(itemId);
    recalculateTotalCost(patient);
    await patient.save();
    res.json(patient);

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 1. Security Check: Ensure the patient belongs to the user's Clinic AND Branch
    const query = {
      _id: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId
    };

    // 2. Prevent updating immutable fields
    // We remove these fields from the update object so they can't be tampered with
    delete updates._id;
    delete updates.clinicId;
    delete updates.branchId;
    delete updates.patientId; // Usually we don't allow changing the ID
    delete updates.createdAt;

    // 3. Perform the Update
    const patient = await Patient.findOneAndUpdate(
      query,
      { $set: updates },
      { new: true, runValidators: true } // Return the updated doc & validate data
    );

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or access denied' });
    }

    res.json(patient);

  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  deletePatient,
  addTreatment,
  startTreatment,
  deleteTreatment,
  updateTreatmentStatus,
  updatePatient
};