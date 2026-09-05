const AuditLog = require('../models/AuditLog');

const logAudit = async ({ req, action, entity, entityId, details }) => {
  try {
    // In a real app, req.user is set by auth middleware
    const user = req.user || { _id: null, fullName: 'System/Guest' }; 

    await AuditLog.create({
      //  FIXED: Attach the multi-tenant and branch IDs
      clinicId: req.clinicId || req.user?.clinicId,
      branchId: req.branchId || req.user?.defaultBranch, 
      
      userId: user._id,
      userName: user.fullName || user.name, // Works with your existing user model
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