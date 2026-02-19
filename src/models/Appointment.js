const mongoose = require('mongoose');

const appointmentSchema = mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  title: {
    type: String, // Storing Patient Name for quick display
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  doctorId: { // Maps to 'docId' from frontend
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorName: { // Maps to 'doc' from frontend (for easy tooltip display)
    type: String, 
  },
  type: { // Procedure (e.g., Root Canal)
    type: String,
    required: true
  },
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true
  },
  resourceId: { // Chair ID (1, 2, 3)
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'No Show', ''],
    default: 'Scheduled'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Appointment', appointmentSchema);