const Patient = require('../models/Patient');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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
    // 1. Capture Query Parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const doctor = req.query.doctor || '';
    const filterTab = req.query.filter || 'all'; // 'all', 'due', 'active'

    // Use provided branchId filter, or fallback to the user's current active branch
    const branchId = req.query.branchId || req.branchId;

    // 2. Build the MongoDB Query Object
    let query = {
      clinicId: req.user.clinicId,
      branchId: branchId
    };

    // A. Search by Name, Phone, or Patient ID
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } }
      ];
    }

    // B. Filter by Assigned Doctor
    if (doctor) {
      query.assignedDoctor = doctor;
    }

    // C. Tab Filters (Active / Dues)
    if (filterTab === 'active') {
      query.isActive = true;
    } else if (filterTab === 'due') {
      // MongoDB expression: totalCost - totalPaid > 0
      query.$expr = { $gt: [{ $subtract: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalPaid", 0] }] }, 0] };
    }

    // 3. Execute Paginated Query
    const skip = (page - 1) * limit;

    const patients = await Patient.find(query)
      .sort({ updatedAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    // 4. Get Total Count for Pagination UI
    const total = await Patient.countDocuments(query);

    const globalTotal = await Patient.countDocuments({ clinicId: req.user.clinicId, branchId: branchId });
    const globalPending = await Patient.countDocuments({
      clinicId: req.user.clinicId,
      branchId: branchId,
      $expr: { $gt: [{ $subtract: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalPaid", 0] }] }, 0] }
    });

    res.json({
      patients,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalCount: total,
      globalTotal,      // ⚡️ Send to frontend
      globalPending     // ⚡️ Send to frontend
    });

  } catch (error) {
    console.error("Fetch Patients Error:", error);
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

// @desc    Upload Patient Attachment (Photo or X-Ray)
// @route   POST /api/patients/:id/upload
const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { id } = req.params;
    const { type } = req.body; // 'photo' or 'xray'

    // 1. Find Patient (Secure)
    const patient = await Patient.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId
    });

    if (!patient) {
      // Clean up the uploaded file if patient not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Patient not found' });
    }

    // 2. Construct File Path (Store relative path in DB)
    // Assuming you serve static files from a 'uploads' folder
    const filePath = `/uploads/${req.file.filename}`;

    // 3. Update Patient Data
    if (type === 'photo') {
      // If replacing profile photo, you might want to delete the old file here
      patient.attachments.photo = filePath;
    } else {
      // Default to X-Ray/Document array
      // Initialize array if it doesn't exist
      if (!patient.attachments) patient.attachments = { xrays: [] };
      if (!patient.attachments.xrays) patient.attachments.xrays = [];

      patient.attachments.xrays.push(filePath);
    }

    await patient.save();

    res.json({
      message: 'File uploaded successfully',
      filePath,
      attachments: patient.attachments
    });

  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};


const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileUrl } = req.body; // Expecting the relative path like "/uploads/file-123.jpg"

    if (!fileUrl) return res.status(400).json({ message: 'File URL is required' });

    // 1. Find the Patient
    const patient = await Patient.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId
    });

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // 2. Remove from Database Array
    // We filter out the matching URL
    if (patient.attachments && patient.attachments.xrays) {
      patient.attachments.xrays = patient.attachments.xrays.filter(url => url !== fileUrl);
    }

    // Also check 'photo' if it matches
    if (patient.attachments.photo === fileUrl) {
      patient.attachments.photo = "";
    }

    await patient.save();

    // 3. Delete from Server Disk (File System)
    // Construct the absolute path: e.g., C:\Projects\DentalApp\backend\uploads\file-123.jpg
    // NOTE: Adjust '..' segments based on where this controller file is located relative to root
    const absolutePath = path.join(__dirname, '..', '..', fileUrl);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath); // This deletes the file
      console.log(`Deleted file: ${absolutePath}`);
    } else {
      console.warn(`File not found on disk: ${absolutePath}`);
    }

    res.json({ message: 'File deleted successfully', attachments: patient.attachments });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};


const bulkCompleteTreatments = async (req, res) => {
  try {
    const { id } = req.params;
    const { treatmentIds } = req.body; // Array of treatment _ids from the modal

    // 1. Find the patient
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // 2. Loop through their treatment plan and update the matching IDs
    let isModified = false;

    patient.treatmentPlan.forEach(treatment => {
      // Convert ObjectIds to strings for safe comparison
      if (treatmentIds.includes(treatment._id.toString())) {
        treatment.status = 'Completed';
        isModified = true;
      }
    });

    // 3. Save the patient if changes were made
    if (isModified) {
      // Mongoose needs to know the array was modified
      patient.markModified('treatmentPlan');
      await patient.save();
    }

    res.json({ message: 'Treatments marked as completed', patient });

  } catch (error) {
    console.error("Bulk Complete Treatments Error:", error);
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
  updatePatient,
  uploadAttachment,
  deleteAttachment,
  bulkCompleteTreatments
};