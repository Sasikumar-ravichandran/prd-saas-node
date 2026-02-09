const AuditLog = require('../models/AuditLog');

const logAudit = async ({ req, action, entity, entityId, details }) => {
  try {
    // In a real app, req.user is set by auth middleware
    const user = req.user || { _id: null, name: 'System/Guest' }; 

    await AuditLog.create({
      userId: user._id,
      userName: user.name,
      action,
      entity,
      entityId,
      details,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`[AUDIT] ${action}: ${details}`);
  } catch (error) {
    // Audit logging should not break the main app flow
    console.error("Audit Log Error:", error);
  }
};

module.exports = logAudit;