const RoleConfig = require('../models/roleConfig');

// 1. GET ALL ROLES FOR A CLINIC
const getRoles = async (req, res) => {
  try {
    // 1. Fetch from DB
    const roles = await RoleConfig.find({ clinicId: req.user.clinicId });

    // 2. Start with a guaranteed structure
    const formattedRoles = {
      admin: [],
      doctor: [],
      receptionist: []
    };

    // 3. Populate only if 'roles' is not empty
    if (roles && roles.length > 0) {
      roles.forEach(role => {
        // Only assign if the roleId exists in our predefined list
        if (role.roleId && formattedRoles.hasOwnProperty(role.roleId)) {
          formattedRoles[role.roleId] = role.permissions || [];
        }
      });
    }

    // 4. Return the object
    res.json(formattedRoles);

  } catch (error) {
    // 5. Log the actual error so we know why it failed
    console.error("CRITICAL GET_ROLES ERROR:", error);
    res.status(500).json({ message: 'Failed to fetch roles', error: error.message });
  }
};

// 2. UPDATE A SPECIFIC ROLE
const updateRole = async (req, res) => {
  try {
    const { roleId, permissions } = req.body;

    // Security Check: Never let them modify the admin role via UI
    if (roleId === 'admin') {
      return res.status(403).json({ message: 'Admin role cannot be modified.' });
    }

    // Upsert: Update if exists, Create if it doesn't
    await RoleConfig.findOneAndUpdate(
      { clinicId: req.user.clinicId, roleId: roleId },
      { permissions: permissions },
      { new: true, upsert: true }
    );

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update role' });
  }
};

module.exports = { getRoles, updateRole };