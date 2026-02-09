const Patient = require('../models/Patient');
const mongoose = require('mongoose');

// @desc    Create a new patient
// @route   POST /api/patients
// @access  Private (Clinic Staff Only)
const createPatient = async (req, res) => {
  try {
    // 1. Destructure data
    const {
      fullName, age, gender, mobile, bloodGroup,
      emergencyContact, emergencyRelation,
      assignedDoctor, referredBy, communication,
      primaryConcern, painLevel, medicalConditions, notes,
      attachments 
    } = req.body;

    // 2. Simple Validation
    if (!fullName || !mobile || !assignedDoctor) {
      return res.status(400).json({ message: 'Name, Mobile, and Doctor are required.' });
    }

    // 3. Auto-Generate Patient ID (Scoped to Clinic)
    // We count only THIS clinic's patients. So every clinic starts at PID-1001.
    const count = await Patient.countDocuments({ clinicId: req.user.clinicId });
    const nextId = 1001 + count; 
    const patientId = `PID-${nextId}`;

    // 4. Create the new Patient Object
    const patient = await Patient.create({
      clinicId: req.user.clinicId, // <--- CRITICAL: Binds patient to this clinic
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