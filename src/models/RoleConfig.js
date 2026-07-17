const mongoose = require('mongoose');

const RoleConfigSchema = new mongoose.Schema({
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true,
    index: true 
  },
  roleId: { 
    type: String, 
    required: true,
    enum: ['administrator', 'doctor', 'receptionist']
  },
  permissions: [{ 
    type: String // Array of permission IDs (e.g., 'fin_view_revenue')
  }]
}, { timestamps: true });

// Ensure a clinic can only have one configuration per roleId
RoleConfigSchema.index({ clinicId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.models.RoleConfig || mongoose.model('RoleConfig', RoleConfigSchema);