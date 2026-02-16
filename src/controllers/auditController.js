const AuditLog = require('../models/AuditLog');

// @desc    Get recent audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId) {
            return res.json([]);
        }

        // 1. Construct the Query
        const query = { 
            clinicId: req.user.clinicId 
        };

        // 2. BRANCH FILTERING LOGIC
        // If the user is a "Super Admin" (Clinic Owner), let them see ALL logs.
        // If they are a Branch Manager/Staff, force the branch filter.
        
        // Option A: Strict Mode (Recommended) - Always filter by active branch context
        // This is less confusing because the UI reflects the current branch header.
        query.branchId = req.branchId; 

        // Option B: Hybrid Mode (Optional)
        // if (req.user.role !== 'Administrator') {
        //    query.branchId = req.branchId;
        // }

        const logs = await AuditLog.find(query)
            .populate('actorId', 'name role') // Useful to see WHO did it
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(logs);
    } catch (error) {
        console.error("Audit Fetch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getAuditLogs };