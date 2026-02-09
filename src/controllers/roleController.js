const RoleConfig = require('../models/RoleConfig');

// Default Permissions (Fallback if DB is empty)
const DEFAULT_PERMISSIONS = {
  admin: ['fin_view_revenue', 'fin_edit_invoice', 'fin_discounts', 'pt_delete', 'pt_export', 'ops_settings', 'ops_calendar'],
  doctor: ['fin_view_revenue', 'ops_calendar'],
  receptionist: ['ops_calendar', 'fin_edit_invoice'],
  nurse: []
};

// @desc    Get permissions map
// @route   GET /api/settings/roles
const getRoleConfig = async (req, res) => {
  try {
    // In a real SaaS, we would find by clinicId: { clinicId: req.user.clinicId }
    // For now, we just find the first document (assuming single setup)
    let config = await RoleConfig.findOne();

    if (!config) {
      // If no config exists, create the default one
      config = await RoleConfig.create({
        permissions: DEFAULT_PERMISSIONS
      });
    }

    res.json(config.permissions);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update permissions for a specific role
// @route   PUT /api/settings/roles
const updateRoleConfig = async (req, res) => {
  try {
    const { roleId, permissions } = req.body; // e.g. { roleId: 'doctor', permissions: ['ops_calendar'] }

    let config = await RoleConfig.findOne();
    if (!config) {
        config = await RoleConfig.create({ permissions: DEFAULT_PERMISSIONS });
    }

    // Update the specific role's array
    config.permissions[roleId] = permissions;
    
    // Mark the field as modified (Mongoose sometimes misses nested object updates)
    config.markModified('permissions'); 

    await config.save();

    res.json(config.permissions);
  } catch (error) {
    console.error("Error updating roles:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getRoleConfig, updateRoleConfig };