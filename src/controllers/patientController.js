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

    // --- FIX STARTS HERE ---
    
    // 1. Find the patient with the highest ID (Sort descending by natural creation or ID)
    // We filter by clinicId so we only look at THIS clinic's IDs
    const lastPatient = await Patient.findOne({ clinicId: req.user.clinicId })
      .sort({ patientId: -1 }) // Get the latest ID (e.g., PID-1005)
      .collation({ locale: "en_US", numericOrdering: true }); // Ensures PID-10 comes after PID-9

    let nextId = 1001; // Default if no patients exist yet

    if (lastPatient && lastPatient.patientId) {
      // Extract the number: "PID-1005" -> "1005" -> 1005
      const lastIdStr = lastPatient.patientId.replace('PID-', '');
      const lastIdNum = parseInt(lastIdStr);
      
      if (!isNaN(lastIdNum)) {
        nextId = lastIdNum + 1; // Increment: 1006
      }
    }

    const patientId = `PID-${nextId}`;

    // --- FIX ENDS HERE ---

    const patient = await Patient.create({
      clinicId: req.user.clinicId,
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
      message: 'Patient registered successfully!'
    });

  } catch (error) {
    console.error("Error creating patient:", error);
    // Handle duplicate key error specifically
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Error generating ID. Please try again.' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all patients (Scoped to Clinic)
// @route   GET /api/patients
// @access  Private
const getPatients = async (req, res) => {
  try {
	if (!req.user || !req.user.clinicId) {
        return res.json([]); 
    }
    // 1. SECURITY: Only find patients belonging to MY clinic
    const patients = await Patient.find({ 
      isActive: true, 
      clinicId: req.user.clinicId // <--- FILTER
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

    let query = { clinicId: req.user.clinicId }; // Base Security Filter
	if (!req.user || !req.user.clinicId) {
        return res.json([]); 
    }

    // Logic: Search by PID or Mongo ID, combined with Clinic ID
    if (id.startsWith('PID-')) {
      query.patientId = id;
    } else if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      return res.status(400).json({ message: 'Invalid Patient ID format' });
    }

    // Only returns if BOTH match (ID + Clinic)
    const patient = await Patient.findOne(query);

    if (patient) {
      res.json(patient);
    } else {
      res.status(404).json({ message: 'Patient not found' });
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

    // 1. Secure Find
    let query = { clinicId: req.user.clinicId };
    if (id.startsWith('PID-')) query.patientId = id;
    else query._id = id;

    const patient = await Patient.findOne(query);

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Add New Treatment
    const newTreatment = {
      tooth,
      procedure,
      cost: Number(cost),
      status: status || 'Proposed' 
    };
    patient.treatmentPlan.push(newTreatment);

    // 3. Update Balance if needed
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

    // 1. Secure Find
    let query = { clinicId: req.user.clinicId };
    if (id.startsWith('PID-')) query.patientId = id;
    else query._id = id;

    const patient = await Patient.findOne(query);

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Logic (Unchanged)
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

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  addTreatment,
  startTreatment,
};