const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    // ===== 1. SaaS Multi-Tenancy (CRITICAL) =====
    // This separates patients by clinic. 
    // Later, when you create a 'Clinic' model, you will link this.
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      // required: true, // Keep commented until we build Auth/Login
    },

    // ===== 2. Patient Identity =====
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true, // Make search faster
    },

    patientId: {
      type: String,
      unique: true, // Ensures no two patients have ID 'PID-1001'
    },

    mobile: {
      type: String,
      trim: true,
      required: true, // Good to make this mandatory
      index: true,    // Search by phone is very common
    },

    email: {          // Added this back (useful for sending invoices)
      type: String,
      trim: true,
      lowercase: true,
    },

    age: {
      type: Number,
      min: 0,
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male',
    },

    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown', ''], // Added '' for empty selection
    },

    address: {       // Added for Billing/Invoices
      type: String,
      trim: true,
    },

    // ===== 3. Emergency Contact =====
    emergencyContact: {
      type: String,
      trim: true,
    },

    emergencyRelation: {
      type: String,
      trim: true,
    },

    // ===== 4. Clinic Info =====
    assignedDoctor: {
      type: String,
      required: true,
    },

    referredBy: {
      type: String,
      // FIX: Add '' to this list so empty selection is valid
      enum: ['Google', 'Friend/Family', 'Walk-in', 'Instagram', 'Other', ''],
      default: ''
    },

    communication: {
      type: String,
      enum: ['WhatsApp', 'SMS', 'Email'],
      default: 'WhatsApp',
    },

    // ===== 5. Clinical Details =====
    primaryConcern: {
      type: String,
    },

    painLevel: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },

    medicalConditions: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
    },

    // ===== 6. Attachments =====
    // We store the URL/Path to the file (e.g., from AWS S3 or Uploads folder)
    attachments: {
      photo: { type: String },
      xrays: [{ type: String }] // Changed 'xray' to 'xrays' (plural is better for arrays)
    },

    // ===== 7. System Status =====
    isActive: {
      type: Boolean,
      default: true, // If false, patient is "Deleted/Archived"
    },

    treatmentPlan: [
      {
        tooth: { type: String },
        procedure: { type: String, required: true },
        cost: { type: Number, required: true },
        // Status determines if the patient owes money
        status: {
          type: String,
          enum: ['Proposed', 'In Progress', 'Completed', 'Cancelled'],
          default: 'Proposed'
        },
        date: { type: Date, default: Date.now }
      }
    ],

    // ===== FINANCIALS =====
    // totalCost = Sum of 'In Progress' + 'Completed' treatments
    totalCost: { type: Number, default: 0 },

    // totalPaid = Sum of all payments received
    totalPaid: { type: Number, default: 0 },

    // walletBalance = totalCost - totalPaid
    walletBalance: { type: Number, default: 0 },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

module.exports = mongoose.model('Patient', PatientSchema);