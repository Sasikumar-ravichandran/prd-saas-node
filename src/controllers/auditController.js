const AuditLog = require('../models/AuditLog');

// @desc    Get recent audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
  try {
    // Fetch last 100 logs, newest first
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100);
      
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getAuditLogs };