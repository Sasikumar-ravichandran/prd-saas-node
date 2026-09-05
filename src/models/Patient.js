const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    // ===== 1. SaaS Multi-Tenancy =====
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

    // ===== 2. Patient Identity =====
    fullName: { type: String, required: true, trim: true, index: true },
    patientId: { type: String },
    mobile: { type: String, trim: true, required: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown', ''] },
    address: { type: String, trim: true },

    // ===== 3. Emergency Contact =====
    emergencyContact: { type: String, trim: true },
    emergencyRelation: { type: String, trim: true },

    // ===== 4. Clinic Info =====
    assignedDoctor: { type: String, required: true },
    referredBy: { 
      type: String, 
      enum: ['Google', 'Friend/Family', 'Walk-in', 'Instagram', 'Other', ''], 
      default: '' 
    },
    communication: { type: String, enum: ['WhatsApp', 'SMS', 'Email'], default: 'WhatsApp' },

    primaryConcern: { type: String },
    painLevel: { type: Number, min: 0, max: 10, default: 0 },
    medicalConditions: { type: [String], default: [] },
    notes: { type: String, trim: true },
    billed: { type: Boolean, default: false },

    specialtyData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // ===== 6. Attachments =====
    attachments: {
      photo: { type: String },
      // Renamed from 'xrays' to 'scans' to be inclusive of MRIs, Retinal Scans, etc.
      scans: [{ type: String }],
      documents: [{ type: String }] 
    },

    // ===== 7. System Status =====
    isActive: { type: Boolean, default: true },

    // ===== 8. Universal Treatment Plan =====
    treatmentPlan: [
      {
        // Example: "Tooth 18" (Dental), "Left Eye" (Vision), "Right Knee" (Physio)
        region: { type: String }, 
        procedure: { type: String, required: true },
        cost: { type: Number, required: true },
        status: {
          type: String,
          enum: ['Proposed', 'In Progress', 'Completed', 'Cancelled'],
          default: 'Proposed'
        },
        date: { type: Date, default: Date.now },
        notes: { type: String } // Added notes for specific procedure details
      }
    ],

    // ===== 9. FINANCIALS =====
    totalCost: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
  },
  {
    timestamps: true, 
  }
);

module.exports = mongoose.model('Patient', PatientSchema);