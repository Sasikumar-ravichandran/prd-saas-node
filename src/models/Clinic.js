const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema({
  // Legal Details
  name: { type: String, required: true }, // Display Name (e.g. Smile Care)
  legalName: { type: String },            // Registered Name (e.g. Smile Care Pvt Ltd)
  registrationNumber: { type: String },   // License / Registration
  gstin: { type: String },                // Tax ID
  
  // Contact
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  
  // Location
  address: { type: String },
  city: { type: String },
  state: { type: String },
  zip: { type: String },

  // Branding (We will use this in the Branding Tab later)
  logo: { type: String }, 
  primaryColor: { type: String, default: '#0f172a' }

}, { timestamps: true });

module.exports = mongoose.model('Clinic', ClinicSchema);