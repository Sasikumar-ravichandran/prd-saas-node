const Patient = require('../models/Patient');

// @desc    Create a new patient
// @route   POST /api/patients
// @access  Public (We will add Auth later)
const createPatient = async (req, res) => {
  try {
    // 1. Destructure data from the frontend request
    const {
      fullName, age, gender, mobile, bloodGroup,
      emergencyContact, emergencyRelation,
      assignedDoctor, referredBy, communication,
      primaryConcern, painLevel, medicalConditions, notes,
      attachments // (e.g., photo URL if you have one)
    } = req.body;

    // 2. Simple Validation
    if (!fullName || !mobile || !assignedDoctor) {
      return res.status(400).json({ message: 'Name, Mobile, and Doctor are required.' });
    }

    // 3. Auto-Generate Patient ID (PID-1001, PID-1002, etc.)
    // We count existing documents to find the next number.
    const count = await Patient.countDocuments();
    const nextId = 1001 + count; 
    const patientId = `PID-${nextId}`;

    // 4. Create the new Patient Object
    const patient = await Patient.create({
      patientId, // Auto-generated
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
      // clinicId: req.user.clinicId (We will add this line when we do Auth)
    });

    // 5. Send Success Response
    if (patient) {
      res.status(201).json({
        _id: patient._id,
        patientId: patient.patientId,
        fullName: patient.fullName,
        message: 'Patient registered successfully!'
      });
    } else {
      res.status(400).json({ message: 'Invalid patient data' });
    }

  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Public
const getPatients = async (req, res) => {
  try {
    // Fetch all patients and sort by newest first (createdAt: -1)
    const patients = await Patient.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
	console.error("Error fetching patients:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single patient by ID
// @route   GET /api/patients/:id
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params; // This will be "PID-1001" or "65c8..."

    let patient;

    // Logic: If it starts with "PID-", search by our custom field
    if (id.startsWith('PID-')) {
      patient = await Patient.findOne({ patientId: id });
    } 
    // Otherwise, check if it's a valid Mongo ID before querying
    else if (mongoose.Types.ObjectId.isValid(id)) {
      patient = await Patient.findById(id);
    } else {
      return res.status(400).json({ message: 'Invalid Patient ID format' });
    }

    // Response
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

const addTreatment = async (req, res) => {
  try {
    const { id } = req.params; // PID-1001
    const { tooth, procedure, cost, status } = req.body;

    // 1. Find Patient (Smart Search)
    let patient;
    if (id.startsWith('PID-')) {
      patient = await Patient.findOne({ patientId: id });
    } else {
      patient = await Patient.findById(id);
    }

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Add New Treatment
    const newTreatment = {
      tooth,
      procedure,
      cost: Number(cost),
      status: status || 'Proposed' // Default to Proposed
    };
    patient.treatmentPlan.push(newTreatment);

    // 3. AUTO-CALCULATE BALANCE
    // Logic: If status is 'Proposed', it's just a quote. Balance doesn't change.
    // If 'In Progress' or 'Completed', the patient owes money.
    if (status === 'In Progress' || status === 'Completed') {
      patient.totalCost = (patient.totalCost || 0) + newTreatment.cost;
      patient.walletBalance = patient.totalCost - (patient.totalPaid || 0);
    }

    // 4. Save
    await patient.save();
    res.status(201).json(patient); // Return updated patient to frontend

  } catch (error) {
    console.error("Error adding treatment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const startTreatment = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Find Patient
    let patient;
    if (id.startsWith('PID-')) {
      patient = await Patient.findOne({ patientId: id });
    } else {
      patient = await Patient.findById(id);
    }

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Find items to update (Status: 'Proposed')
    const proposedItems = patient.treatmentPlan.filter(item => item.status === 'Proposed');

    if (proposedItems.length === 0) {
      return res.status(400).json({ message: 'No proposed treatments to start.' });
    }

    // 3. Update Status & Calculate New Cost
    let addedCost = 0;
    
    patient.treatmentPlan.forEach(item => {
      if (item.status === 'Proposed') {
        item.status = 'In Progress'; // Move to active
        addedCost += item.cost;      // Add to total bill
      }
    });

    // 4. Update Financials
    patient.totalCost = (patient.totalCost || 0) + addedCost;
    patient.walletBalance = patient.totalCost - (patient.totalPaid || 0);

    // 5. Save & Return
    await patient.save();
    
    res.json({
      message: `${proposedItems.length} treatments started`,
      patient // Return the whole updated patient object
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