const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  // WHO did it?
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String }, // Store snapshot of name in case user is deleted

  // WHAT did they do?
  action: { type: String, required: true }, // e.g., "DELETE_PATIENT", "UPDATE_PRICE"
  
  // WHERE did they do it?
  entity: { type: String }, // e.g., "Patient", "Procedure"
  entityId: { type: String }, // The ID of the item affected

  // DETAILS (Human readable)
  details: { type: String }, 
  
  // METADATA
  ipAddress: { type: String },
  userAgent: { type: String }, // Browser info

}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);