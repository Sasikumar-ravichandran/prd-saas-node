const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Verify Token
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      
      // Get user and populate essential fields for the security check
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // 2. ATTACH CLINIC ID (The Global Tenant)
      // Controllers should use this to ensure Clinic A never sees Clinic B data
      req.clinicId = req.user.clinicId;

      // 3. HANDLE BRANCH CONTEXT (The Location Tenant)
      const activeBranchId = req.headers['x-branch-id'];

      if (activeBranchId) {
        // SECURITY CHECK: Convert ObjectIds to strings for comparison
        const allowedBranchStrings = req.user.allowedBranches.map(id => id.toString());
        const isAllowed = allowedBranchStrings.includes(activeBranchId);

        // Allow if user is an Administrator OR if the branch is in their allowed list
        if (req.user.role === 'Administrator' || isAllowed) {
          req.branchId = activeBranchId;
        } else {
          return res.status(403).json({ message: 'Access to this specific branch denied' });
        }
      } else {
        // FALLBACK: If no header, use the user's default branch
        if (req.user.defaultBranch) {
          req.branchId = req.user.defaultBranch.toString();
        } else if (req.user.role !== 'Administrator') {
          // If not admin and no branch set, they shouldn't be making data requests
          return res.status(400).json({ message: 'No active branch context provided' });
        }
      }

      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Roles can be tricky - using a flexible check
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'Administrator' || req.user.role === 'Admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
  }
};

module.exports = { protect, adminOnly };