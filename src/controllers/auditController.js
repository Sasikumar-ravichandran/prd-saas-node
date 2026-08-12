const AuditLog = require('../models/AuditLog');

// @desc    Get recent audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId) {
            return res.json([]);
        }

        // 1. Construct the Query (Ensures Clinic A never sees Clinic B's logs)
        const query = { 
            clinicId: req.user.clinicId 
        };

        // 2. BRANCH FILTERING LOGIC
        // Only show logs for the branch the user is currently viewing
        if (req.branchId) {
            query.branchId = req.branchId;
        }

        const logs = await AuditLog.find(query)
            //  FIXED: Changed 'actorId' to 'userId' and fetched 'fullName'
            .populate('userId', 'fullName role') 
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(logs);
    } catch (error) {
        console.error("Audit Fetch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getAuditLogs };