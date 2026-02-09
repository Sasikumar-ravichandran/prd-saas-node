const AuditLog = require('../models/AuditLog');

// @desc    Get recent audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
	try {
		if (!req.user || !req.user.clinicId) {
			return res.json([]);
		}
		// SECURITY CRITICAL: 
		// Only fetch logs that belong to the logged-in user's clinic ID.
		// Never use .find() without a filter in a SaaS app!
		const logs = await AuditLog.find({ clinicId: req.user.clinicId })
			.sort({ createdAt: -1 }) // Newest first
			.limit(100);             // Limit to last 100 actions

		res.json(logs);
	} catch (error) {
		console.error("Audit Fetch Error:", error);
		res.status(500).json({ message: 'Server Error' });
	}
};

module.exports = { getAuditLogs };