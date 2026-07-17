const ClinicRole = require('../models/ClinicRole');

const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role; // Assuming you save 'doctor' or 'receptionist' on the JWT

      // 1. Admins automatically pass all checks
      if (userRole === 'admin') {
        return next(); 
      }

      // 2. Look up the clinic's custom configuration for this user's role
      const roleConfig = await ClinicRole.findOne({ 
        clinicId: req.user.clinicId, 
        roleId: userRole 
      });

      // 3. Check if the permission exists in their array
      if (!roleConfig || !roleConfig.permissions.includes(requiredPermission)) {
        return res.status(403).json({ 
          message: 'Access Denied: You do not have permission to perform this action.' 
        });
      }

      // 4. They have permission, proceed to the controller!
      next();
    } catch (error) {
      res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

module.exports = requirePermission;