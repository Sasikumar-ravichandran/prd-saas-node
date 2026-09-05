const AuditLog = require('../models/AuditLog');

// @desc    Get recent audit logs
// @route   GET /api/audit-logs
const getAuditLogs = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId) {
            return res.json({ logs: [], totalCount: 0, totalPages: 0, currentPage: 1 });
        }

        // 1. Construct the Query
        const query = { clinicId: req.user.clinicId };
        if (req.branchId) {
            query.branchId = req.branchId;
        }

        // 2. Server-Side Pagination Math
        // Read page and limit from the query string (defaults to page 1, limit 15)
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 15;
        const skip = (page - 1) * limit;

        // 3. Run queries in parallel for maximum speed
        const [logs, totalCount] = await Promise.all([
            AuditLog.find(query)
                .populate('userId', 'fullName role') 
                .sort({ createdAt: -1 })
                .skip(skip)    // ⚡️ Skip previous pages
                .limit(limit), // ⚡️ Fetch only current page size
            AuditLog.countDocuments(query) // Get total number of logs in DB
        ]);

        // 4. Return structured response
        res.json({
            logs,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Audit Fetch Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getAuditLogs };