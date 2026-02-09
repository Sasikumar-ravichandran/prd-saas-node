const RoleConfig = require('../models/RoleConfig');

const DEFAULT_PERMISSIONS = {
  admin: ['fin_view_revenue', 'fin_edit_invoice', 'fin_discounts', 'pt_delete', 'pt_export', 'ops_settings', 'ops_calendar'],
  doctor: ['fin_view_revenue', 'ops_calendar'],
  receptionist: ['ops_calendar', 'fin_edit_invoice'],
  nurse: []
};

// @desc    Get permissions map
const getRoleConfig = async (req, res) => {
  try {
  
    if (!req.user?.clinicId) {
        console.error("User has no Clinic ID linked.");
        // Return default permissions temporarily so frontend doesn't break
        return res.json(DEFAULT_PERMISSIONS);
    }

    //  Find Config
    let config = await RoleConfig.findOne({ clinicId: req.user.clinicId });

    if (!config) {
      try {
        config = await RoleConfig.create({
          clinicId: req.user.clinicId,
          permissions: DEFAULT_PERMISSIONS
        });
      } catch (createErr) {
        // Fallback: Send defaults even if DB save failed
        return res.json(DEFAULT_PERMISSIONS);
      }
    }

    res.json(config.permissions);

  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update permissions
const updateRoleConfig = async (req, res) => {
  try {
    const { roleId, permissions } = req.body; 

    if (!req.user.clinicId) {
        return res.status(400).json({ message: 'User not linked to clinic' });
    }

    let config = await RoleConfig.findOne({ clinicId: req.user.clinicId });
    
    if (!config) {
        config = await RoleConfig.create({
            clinicId: req.user.clinicId,
            permissions: DEFAULT_PERMISSIONS
        });
    }

    // Update permission
    config.permissions[roleId] = permissions;
    config.markModified('permissions'); 

    await config.save();
    res.json(config.permissions);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getRoleConfig, updateRoleConfig };