const mongoose = require('mongoose');

// 1. Define the Medication Sub-Schema first
const medicationSchema = new mongoose.Schema({
  drugName: { type: String, required: true },
  dosage: { type: String, required: true },
  duration: { type: String, required: true },
  instruction: { type: String, default: "" },
  type: { type: String, default: "Tablet" }
}, { _id: false }); // _id: false stops Mongoose from creating unique IDs for every row

const PrescriptionSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

  // ⚡️ Reference the sub-schema here
  medications: [medicationSchema],

  notes: String,
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', PrescriptionSchema);