// controllers/superAdminController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Branch = require('../models/Branch');
const RoleConfig = require('../models/RoleConfig');
const Otp = require('../models/Otp');
// Replace with your actual Patient model path:
const Patient = require('../models/Patient');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123azb', { expiresIn: '7d' });
};

// ==========================================
// @desc    SaaS Founder / Super Admin Login
// @route   POST /api/super-admin/login
// ==========================================
const superAdminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user && (await user.matchPassword(password))) {
      // Edge Case Fix: Reject even valid passwords if not a Super Admin
      if (!user.isSuperAdmin) {
        return res.status(403).json({ 
          message: 'Access Denied: You do not have SaaS Founder access.' 
        });
      }

      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: 'SuperAdmin',
        isSuperAdmin: true,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid founder email or password.' });
    }
  } catch (error) {
    console.error('Super Admin Login Error:', error);
    res.status(500).json({ message: 'Server Error during authentication.' });
  }
};

// ==========================================
// @desc    Get SaaS Command Center Overview & Clinic Directory
// @route   GET /api/super-admin/dashboard-data
// ==========================================
const getDashboardData = async (req, res) => {
  try {
    // 1. Run global counts and fetch clinics in parallel
    const [clinics, totalUsers, totalBranches, totalPatients] = await Promise.all([
      Clinic.find().sort({ createdAt: -1 }).lean(),
      User.countDocuments({ isSuperAdmin: { $ne: true } }),
      Branch.countDocuments(),
      Patient.countDocuments()
    ]);

    // 2. Map Administrators for each clinic
    const clinicIds = clinics.map(c => c._id);
    const adminUsers = await User.find({
      clinicId: { $in: clinicIds },
      role: 'Administrator'
    }).select('clinicId fullName email createdAt').lean();

    const adminMap = {};
    adminUsers.forEach(admin => {
      adminMap[admin.clinicId] = admin;
    });

    // 3. Attach aggregate counts per clinic (No patient data ever loaded into memory!)
    const enrichedClinics = await Promise.all(
      clinics.map(async (clinic) => {
        const [userCount, patientCount, branchCount] = await Promise.all([
          User.countDocuments({ clinicId: clinic._id }),
          Patient.countDocuments({ clinicId: clinic._id }),
          Branch.countDocuments({ clinicId: clinic._id })
        ]);

        return {
          ...clinic,
          adminName: adminMap[clinic._id]?.fullName || 'Pending Admin',
          adminEmail: adminMap[clinic._id]?.email || 'N/A',
          userCount,
          patientCount,
          branchCount
        };
      })
    );

    const stats = {
      totalClinics: clinics.length,
      pendingApproval: clinics.filter(c => c.accountStatus === 'Pending_Approval').length,
      activeClinics: clinics.filter(c => c.accountStatus === 'Active').length,
      suspendedClinics: clinics.filter(c => c.accountStatus === 'Suspended').length,
      totalUsers,
      totalBranches,
      totalPatients
    };

    res.status(200).json({ stats, clinics: enrichedClinics });
  } catch (error) {
    console.error('Super Admin Dashboard Error:', error);
    res.status(500).json({ message: 'Failed to load SaaS analytics.' });
  }
};

// ==========================================
// @desc    Approve, Suspend, or Reactivate a Clinic
// @route   PUT /api/super-admin/clinics/:id/status
// ==========================================
const updateClinicStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Pending_Approval', 'Suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value provided.' });
    }

    const clinic = await Clinic.findByIdAndUpdate(
      req.params.id,
      { accountStatus: status },
      { new: true }
    );

    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found.' });
    }

    res.json({ message: `Clinic status updated to ${status}.`, clinic });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ message: 'Failed to update clinic status.' });
  }
};

// ==========================================
// @desc    Permanently Delete a Clinic (Cascading Teardown)
// @route   DELETE /api/super-admin/clinics/:id
// ==========================================
const deleteClinic = async (req, res) => {
  try {
    const clinicId = req.params.id;
    const clinic = await Clinic.findById(clinicId);

    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found.' });
    }

    // Edge Case Fix: Prevent accidental Super Admin account wipe
    const superAdminInClinic = await User.findOne({ clinicId, isSuperAdmin: true });
    if (superAdminInClinic) {
      return res.status(400).json({ 
        message: 'Security Block: Cannot delete a clinic associated with a Super Admin.' 
      });
    }

    // Edge Case Fix: Cascading wipe of all tenant data to prevent orphan records
    await Promise.all([
      User.deleteMany({ clinicId }),
      Branch.deleteMany({ clinicId }),
      Patient.deleteMany({ clinicId }),
      RoleConfig.deleteMany({ clinicId }),
      Clinic.findByIdAndDelete(clinicId)
    ]);

    res.json({ message: `Clinic '${clinic.name}' and all associated tenant records permanently deleted.` });
  } catch (error) {
    console.error('Delete Clinic Error:', error);
    res.status(500).json({ message: 'Failed to delete clinic.' });
  }
};

module.exports = {
  superAdminLogin,
  getDashboardData,
  updateClinicStatus,
  deleteClinic
};