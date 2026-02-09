const mongoose = require('mongoose');

const RoleConfigSchema = new mongoose.Schema({
  // Link to Clinic (for SaaS multi-tenancy)
  // clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },

  // For now, since we are single-tenant/dev mode, we can just use a fixed ID or omit it.
  // But ideally, permissions are stored per role.
  
  permissions: {
    admin: [{ type: String }],       // List of permission IDs like 'fin_view_revenue'
    doctor: [{ type: String }],
    receptionist: [{ type: String }],
    nurse: [{ type: String }]
  }
}, { timestamps: true });

module.exports = mongoose.model('RoleConfig', RoleConfigSchema);