const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const Appointment = require('../models/Appointment');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { uploadFileToR2, deleteFileFromR2 } = require('../services/s3Service');
const v4 = require('uuid').v4;

//  IMPORT THE AUDIT LOGGER
const logAudit = require('../utils/auditLogger');


const uploadPatientFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file; // Captured via multer middleware
    const { type } = req.body; 

    if (!file) return res.status(400).json({ message: 'No file provided' });

    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const fileExtension = file.originalname.split('.').pop();
    const uniqueKey = `${req.user.clinicId}/${patient._id}/${v4()}.${fileExtension}`;

    //Call your clean S3 service to handle the actual upload
    await uploadFileToR2(file.buffer, file.mimetype, uniqueKey);

    const fileUrl = `${process.env.AWS_CDN_DOMAIN}/${uniqueKey}`;

    // Update patient attachments schema
    if (!patient.attachments) patient.attachments = { photo: '', scans: [], documents: [] };

    if (type === 'photo') {
      patient.attachments.photo = fileUrl;
    } else if (type === 'document') {
      if (!patient.attachments.documents) patient.attachments.documents = [];
      patient.attachments.documents.push(fileUrl);
    } else {
      if (!patient.attachments.scans) patient.attachments.scans = [];
      patient.attachments.scans.push(fileUrl);
    }

    patient.markModified('attachments');
    await patient.save();

    res.status(200).json({ message: 'File uploaded successfully', fileUrl, attachments: patient.attachments });
  } catch (error) {
    console.error("Server-side Upload Error:", error);
    res.status(500).json({ message: 'Failed to upload file to cloud' });
  }
};

const getCloudUploadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) return res.status(400).json({ message: 'File name and type are required' });

    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const uploadData = await uploadFileToR2(fileName, fileType, req.user.clinicId, patient._id);
    res.status(200).json({ data: uploadData });
  } catch (error) {
    console.error("Presigned URL Error:", error);
    res.status(500).json({ message: 'Failed to generate upload URL' });
  }
};

const saveAttachmentUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, fileUrl } = req.body;

    if (!fileUrl) return res.status(400).json({ message: 'File URL is required' });

    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (!patient.attachments) patient.attachments = { photo: '', scans: [], documents: [] };

    if (type === 'photo') {
      patient.attachments.photo = fileUrl;
    } else if (type === 'document') {
      if (!patient.attachments.documents) patient.attachments.documents = [];
      patient.attachments.documents.push(fileUrl);
    } else {
      if (!patient.attachments.scans) patient.attachments.scans = [];
      patient.attachments.scans.push(fileUrl);
    }

    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'UPLOAD_FILE', entity: 'Patient', entityId: patient._id,
      details: `Uploaded new ${type} to patient profile`
    });

    res.status(200).json({ message: 'File saved to profile', attachments: patient.attachments });
  } catch (error) {
    console.error("Save Attachment Error:", error);
    res.status(500).json({ message: 'Failed to save attachment link' });
  }
};

const deleteCloudAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileUrl } = req.body; 

    if (!fileUrl) return res.status(400).json({ message: 'File URL is required' });

    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (patient.attachments) {
      if (patient.attachments.scans) patient.attachments.scans = patient.attachments.scans.filter(url => url !== fileUrl);
      if (patient.attachments.documents) patient.attachments.documents = patient.attachments.documents.filter(url => url !== fileUrl);
      if (patient.attachments.photo === fileUrl) patient.attachments.photo = "";
    }
    await patient.save();

    const cdnDomain = process.env.AWS_CDN_DOMAIN;
    if (fileUrl.includes(cdnDomain)) {
      const fileKey = fileUrl.split(`${cdnDomain}/`)[1];
      if (fileKey) await deleteFileFromR2(fileKey);
    }

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_FILE', entity: 'Patient', entityId: patient._id,
      details: `Deleted a cloud attachment from patient profile`
    });

    res.status(200).json({ message: 'File permanently deleted', attachments: patient.attachments });
  } catch (error) {
    console.error("Cloud Delete Error:", error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
};

const scanIntakeForm = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided." });

    const clinic = await Clinic.findOne({ clinicId: req.user.clinicId });
    const apiKey = clinic?.aiConfig?.geminiApiKey;

    if (!apiKey) return res.status(400).json({ success: false, message: "API_KEY_MISSING" });

    const extractedData = await extractFormData(req.file.buffer, req.file.mimetype, apiKey);

    //  AUDIT LOG
    logAudit({
      req, action: 'AI_SCAN', entity: 'System', entityId: req.user.clinicId,
      details: `Scanned intake form using AI OCR`
    });

    res.status(200).json({ success: true, data: extractedData });
  } catch (error) {
    if (error.status === 429) return res.status(429).json({ message: "LIMIT_REACHED" });
    res.status(500).json({ message: "Failed to read form." });
  }
};

const createPatient = async (req, res) => {
  try {
    const {
      fullName, age, gender, mobile, bloodGroup, emergencyContact, emergencyRelation,
      assignedDoctor, referredBy, communication, primaryConcern, painLevel, medicalConditions, notes,
      attachments, patientId: customPatientId, specialtyData
    } = req.body;

    if (!fullName || !mobile || !assignedDoctor) {
      return res.status(400).json({ message: 'Name, Mobile, and Doctor are required.' });
    }

    let finalPatientId;

    if (customPatientId && customPatientId.trim() !== '') {
      const existingId = await Patient.findOne({ clinicId: req.user.clinicId, patientId: customPatientId.trim() });
      if (existingId) return res.status(400).json({ message: `Patient ID '${customPatientId}' is already in use.` });
      finalPatientId = customPatientId.trim();
    } else {
      const lastPatient = await Patient.findOne({ clinicId: req.user.clinicId, patientId: { $regex: /^PID-\d+$/ } })
        .sort({ patientId: -1 })
        .collation({ locale: "en_US", numericOrdering: true });

      let nextId = 1001;
      if (lastPatient && lastPatient.patientId) {
        const lastIdStr = lastPatient.patientId.replace('PID-', '');
        const lastIdNum = parseInt(lastIdStr);
        if (!isNaN(lastIdNum)) nextId = lastIdNum + 1;
      }
      finalPatientId = `PID-${nextId}`;
    }

    const patient = await Patient.create({
      clinicId: req.user.clinicId, branchId: req.branchId, patientId: finalPatientId, 
      fullName, age, gender, mobile, bloodGroup, emergencyContact, emergencyRelation, assignedDoctor, referredBy, communication,
      primaryConcern, painLevel, medicalConditions, notes,
      specialtyData: specialtyData || {},
      attachments: attachments || { photo: '', scans: [], documents: [] }
    });

    //  AUDIT LOG
    logAudit({
      req, action: 'CREATE_PATIENT', entity: 'Patient', entityId: patient._id,
      details: `Created new patient profile for ${patient.fullName} (${patient.patientId})`
    });

    res.status(201).json({
      _id: patient._id, patientId: patient.patientId, fullName: patient.fullName, branchId: patient.branchId, message: 'Patient registered successfully!'
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Error generating ID. Please try again.' });
    res.status(500).json({ message: 'Server Error' });
  }
};

const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { clinicId: req.user.clinicId, branchId: req.branchId };
    if (id.startsWith('PID-')) query.patientId = id; else query._id = id;

    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ message: 'Patient not found or access denied' });

    const patientName = patient.fullName;
    const patientDisplayId = patient.patientId;
    const patientMongoId = patient._id;

    await patient.deleteOne();

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_PATIENT', entity: 'Patient', entityId: patientMongoId,
      details: `Permanently deleted patient ${patientName} (${patientDisplayId})`
    });

    res.json({ message: 'Patient record deleted successfully' });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getPatients = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const doctor = req.query.doctor || '';
    const filterTab = req.query.filter || 'all'; 
    const branchId = req.query.branchId || req.branchId;

    let query = { clinicId: req.user.clinicId, branchId: branchId };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } }
      ];
    }

    if (doctor) query.assignedDoctor = doctor;

    if (filterTab === 'active') {
      query.isActive = true;
    } else if (filterTab === 'due') {
      query.$expr = { $gt: [{ $subtract: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalPaid", 0] }] }, 0] };
    }

    const skip = (page - 1) * limit;

    const patients = await Patient.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit);
    const total = await Patient.countDocuments(query);
    const globalTotal = await Patient.countDocuments({ clinicId: req.user.clinicId, branchId: branchId });
    const globalPending = await Patient.countDocuments({
      clinicId: req.user.clinicId, branchId: branchId,
      $expr: { $gt: [{ $subtract: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalPaid", 0] }] }, 0] }
    });

    res.json({ patients, totalPages: Math.ceil(total / limit), currentPage: page, totalCount: total, globalTotal, globalPending });
  } catch (error) {
    console.error("Fetch Patients Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { clinicId: req.user.clinicId, branchId: req.branchId };

    if (id.startsWith('PID-')) query.patientId = id;
    else if (mongoose.Types.ObjectId.isValid(id)) query._id = id;
    else return res.status(400).json({ message: 'Invalid Patient ID format' });

    const patient = await Patient.findOne(query).lean();

    if (patient) {
      const appointments = await Appointment.find({ clinicId: req.user.clinicId, patientId: patient._id }).sort({ start: 1 }).lean();
      const invoices = await Invoice.find({ clinicId: req.user.clinicId, patientId: patient._id }).sort({ createdAt: -1 }).lean();
      patient.appointments = appointments;
      patient.invoices = invoices;
      res.json(patient);
    } else {
      res.status(404).json({ message: 'Patient not found in this branch' });
    }
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateSpecialtyDataKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { key, value } = req.body; 

    let query = { clinicId: req.user.clinicId, branchId: req.branchId };
    if (id.startsWith('PID-')) query.patientId = id; else query._id = id;

    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (!patient.specialtyData) patient.specialtyData = {};

    if (!value || value === 'healthy' || value === 'clear') {
      delete patient.specialtyData[key];
    } else {
      patient.specialtyData[key] = value;
    }

    patient.markModified('specialtyData');
    await patient.save();
    
    //  AUDIT LOG
    logAudit({
      req, action: 'UPDATE_CLINICAL_DATA', entity: 'Patient', entityId: patient._id,
      details: `Updated specialty finding for Region/Key: ${key}`
    });
    
    const appointments = await Appointment.find({ patientId: patient._id }).lean();
    const patientObj = patient.toObject();
    patientObj.appointments = appointments;

    res.json(patientObj);
  } catch (error) {
    console.error("Specialty Data Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const addTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const { region, tooth, procedure, cost, status, notes } = req.body; 

    let query = { clinicId: req.user.clinicId, branchId: req.branchId };
    if (id.startsWith('PID-')) query.patientId = id; else query._id = id;

    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const newTreatment = {
      region: region || tooth || 'General',
      procedure, cost: Number(cost), status: status || 'Proposed', notes: notes || ''
    };
    
    patient.treatmentPlan.push(newTreatment);

    if (status === 'In Progress' || status === 'Completed') {
      patient.totalCost = (patient.totalCost || 0) + newTreatment.cost;
      patient.walletBalance = patient.totalCost - (patient.totalPaid || 0);
    }

    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'ADD_TREATMENT', entity: 'Patient', entityId: patient._id,
      details: `Added treatment: ${procedure} (₹${cost}) to ${newTreatment.region}`
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error("Error adding treatment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const startTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { clinicId: req.user.clinicId, branchId: req.branchId };
    if (id.startsWith('PID-')) query.patientId = id; else query._id = id;

    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const proposedItems = patient.treatmentPlan.filter(item => item.status === 'Proposed');
    if (proposedItems.length === 0) return res.status(400).json({ message: 'No proposed treatments to start.' });

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

    //  AUDIT LOG
    logAudit({
      req, action: 'START_TREATMENT', entity: 'Patient', entityId: patient._id,
      details: `Started ${proposedItems.length} proposed treatment(s)`
    });

    res.json({ message: `${proposedItems.length} treatments started`, patient });
  } catch (error) {
    console.error("Error starting treatment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateTreatmentStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status } = req.body;

    const patient = await Patient.findOne({ patientId: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const treatment = patient.treatmentPlan.id(itemId);
    if (!treatment) return res.status(404).json({ message: 'Treatment item not found' });

    const oldStatus = treatment.status;
    treatment.status = status;

    if (status === 'Proposed') treatment.completedDate = undefined;
    else if (status === 'Completed') treatment.completedDate = new Date();
    
    recalculateTotalCost(patient);
    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'UPDATE_TREATMENT_STATUS', entity: 'Patient', entityId: patient._id,
      details: `Changed treatment '${treatment.procedure}' status from ${oldStatus} to ${status}`
    });

    res.json(patient);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const recalculateTotalCost = (patient) => {
  patient.totalCost = patient.treatmentPlan.reduce((total, item) => {
    if (item.status === 'Completed' || item.status === 'In Progress') return total + (item.cost || 0);
    return total;
  }, 0);
};

const deleteTreatment = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const patient = await Patient.findOne({ patientId: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const treatment = patient.treatmentPlan.id(itemId);
    if (!treatment) return res.status(404).json({ message: 'Treatment item not found' });

    const procedureName = treatment.procedure;
    patient.treatmentPlan.pull(itemId);
    
    recalculateTotalCost(patient);
    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_TREATMENT', entity: 'Patient', entityId: patient._id,
      details: `Deleted treatment plan item: ${procedureName}`
    });

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
    const query = { _id: id, clinicId: req.user.clinicId, branchId: req.branchId };
    
    delete updates._id; delete updates.clinicId; delete updates.branchId; delete updates.patientId; delete updates.createdAt;

    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ message: 'Patient not found or access denied' });

    if (updates.specialtyData) {
      patient.specialtyData = { ...patient.specialtyData, ...updates.specialtyData };
      patient.markModified('specialtyData');
      delete updates.specialtyData;
    }

    Object.assign(patient, updates);
    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'UPDATE_PATIENT', entity: 'Patient', entityId: patient._id,
      details: `Updated demographic or clinical profile information`
    });

    res.json(patient);
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { id } = req.params;
    const { type } = req.body; 
    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });

    if (!patient) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Patient not found' });
    }

    const filePath = `/uploads/${req.file.filename}`;
    if (!patient.attachments) patient.attachments = { photo: '', scans: [], documents: [] };

    if (type === 'photo') patient.attachments.photo = filePath;
    else if (type === 'document') {
      if (!patient.attachments.documents) patient.attachments.documents = [];
      patient.attachments.documents.push(filePath);
    } else {
      if (!patient.attachments.scans) patient.attachments.scans = [];
      patient.attachments.scans.push(filePath);
    }

    await patient.save();

    //  AUDIT LOG
    logAudit({
      req, action: 'UPLOAD_FILE_LOCAL', entity: 'Patient', entityId: patient._id,
      details: `Uploaded new ${type} to local storage`
    });

    res.json({ message: 'File uploaded successfully', filePath, attachments: patient.attachments });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileUrl } = req.body; 

    if (!fileUrl) return res.status(400).json({ message: 'File URL is required' });
    const patient = await Patient.findOne({ _id: id, clinicId: req.user.clinicId, branchId: req.branchId });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    if (patient.attachments) {
      if (patient.attachments.scans) patient.attachments.scans = patient.attachments.scans.filter(url => url !== fileUrl);
      if (patient.attachments.documents) patient.attachments.documents = patient.attachments.documents.filter(url => url !== fileUrl);
      if (patient.attachments.photo === fileUrl) patient.attachments.photo = "";
    }
    await patient.save();

    const absolutePath = path.join(__dirname, '..', '..', fileUrl);
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath); 

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_FILE_LOCAL', entity: 'Patient', entityId: patient._id,
      details: `Deleted a file from local storage`
    });

    res.json({ message: 'File deleted successfully', attachments: patient.attachments });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const bulkCompleteTreatments = async (req, res) => {
  try {
    const { id } = req.params;
    const { treatmentIds } = req.body; 

    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    let isModified = false;
    patient.treatmentPlan.forEach(treatment => {
      if (treatmentIds.includes(treatment._id.toString())) {
        treatment.status = 'Completed';
        isModified = true;
      }
    });

    if (isModified) {
      patient.markModified('treatmentPlan');
      recalculateTotalCost(patient); 
      await patient.save();
      
      //  AUDIT LOG
      logAudit({
        req, action: 'BULK_COMPLETE_TREATMENT', entity: 'Patient', entityId: patient._id,
        details: `Marked ${treatmentIds.length} treatment(s) as Completed simultaneously`
      });
    }

    res.json({ message: 'Treatments marked as completed', patient });
  } catch (error) {
    console.error("Bulk Complete Treatments Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  scanIntakeForm,
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
  bulkCompleteTreatments,
  updateSpecialtyDataKey,
  getCloudUploadUrl,
  saveAttachmentUrl,
  deleteCloudAttachment,
  uploadPatientFile
};