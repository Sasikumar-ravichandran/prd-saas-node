const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const RoleConfig = require('../models/RoleConfig');
const Otp = require('../models/Otp');
const { sendEmail, getOtpEmailTemplate } = require('../services/emailService');

// ==========================================
// SECURITY & TOKEN HELPERS
// ==========================================

// Helper: SHA-256 OTP Hasher
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// Helper: Generate JWT and attach it to an HttpOnly Secure Cookie
const sendTokenResponse = (userPayload, statusCode, res) => {
  const token = jwt.sign({ id: userPayload._id }, process.env.JWT_SECRET || 'secret123azb', {
    expiresIn: '30d',
  });

  const options = {
    httpOnly: true, // Invisible to JavaScript (Prevents XSS Attacks)
    secure: process.env.NODE_ENV === 'production', // True on HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Prevents CSRF
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Days
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({ ...userPayload, token }); // ⚠️ Keeping token in JSON temporarily to prevent breaking old Redux code
};

// ==========================================
// @desc    Send OTP to Email (For Signup or Reset Password)
// @route   POST /api/auth/send-otp
// ==========================================
const sendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) return res.status(400).json({ message: 'Email and purpose are required.' });

    const cleanEmail = email.toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Prevent OTP Resend Spam
    const recentOtp = await Otp.findOne({ 
      email: cleanEmail, 
      purpose,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } 
    });

    if (recentOtp) {
      const secondsLeft = Math.ceil((60 * 1000 - (Date.now() - recentOtp.createdAt)) / 1000);
      return res.status(429).json({ message: `Please wait ${secondsLeft} seconds before requesting another code.` });
    }

    const existingUser = await User.findOne({ email: cleanEmail });

    if (purpose === 'SIGNUP_VERIFY' && existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    if (purpose === 'PASSWORD_RESET' && !existingUser) {
      return res.status(200).json({ message: 'If an account exists for this email, an OTP has been sent.' });
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Clear old OTPs and save new one
    await Otp.deleteMany({ email: cleanEmail, purpose });
    await Otp.create({
      email: cleanEmail,
      otpHash: hashOtp(otp),
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[OTP GENERATED] (${purpose}) for ${cleanEmail}: ${otp}`);

    await sendEmail({
      to: cleanEmail,
      subject: purpose === 'SIGNUP_VERIFY' ? 'Verify Your Clinic Registration' : 'Password Reset Verification Code',
      html: getOtpEmailTemplate(otp, purpose),
    });

    return res.status(200).json({ message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
  }
};

// ==========================================
// @desc    Register New Clinic
// @route   POST /api/auth/register
// ==========================================
const registerClinic = async (req, res) => {
  try {
    const { clinicName, fullName, clinicType, email, password, otp } = req.body;

    if (!fullName || !clinicName || !email || !password || !otp) {
      return res.status(400).json({ message: 'Missing required fields, including verification OTP.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: cleanEmail })) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    //DEV BYPASS SUPPORT: Check if dev environment and master bypass code is used
    const isDev = process.env.NODE_ENV !== 'production';
    const isMasterBypass = otp === '123456' || process.env.BYPASS_EMAIL_VERIFICATION === 'true';

    let otpRecord = null;

    if (!(isDev && isMasterBypass)) {
      // Standard database check if bypass is not active
      otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'SIGNUP_VERIFY' });
      if (!otpRecord) return res.status(400).json({ message: 'OTP expired or not found. Please request a new code.' });

      if (otpRecord.attempts >= 5) {
        await Otp.deleteOne({ _id: otpRecord._id });
        return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
      }

      if (hashOtp(otp) !== otpRecord.otpHash) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
      }
    } else {
      console.log(`[DEV BYPASS] Clinic registration OTP bypassed for ${cleanEmail} using test code.`);
    }

    const clinic = await Clinic.create({
      name: clinicName,
      clinicId: `CL-${Math.floor(1000 + Math.random() * 9000)}`,
      clinicType: clinicType || 'General_Practice', 
    });

    const user = await User.create({
      clinicId: clinic._id,
      name: fullName,
      fullName: fullName,
      email: cleanEmail,
      password,
      role: 'Administrator',
      defaultBranch: null,
      allowedBranches: [],
      doctorConfig: { commissionPercentage: 0 },
    });

    await RoleConfig.insertMany([
      { clinicId: clinic._id, roleId: 'administrator', permissions: ['fin_view_revenue', 'fin_edit_invoice', 'fin_discounts', 'pt_delete', 'pt_export', 'ops_settings', 'ops_calendar', 'branch_manage', 'branch_create', 'user_manage_global'] },
      { clinicId: clinic._id, roleId: 'doctor', permissions: ['fin_view_revenue', 'ops_calendar'] },
      { clinicId: clinic._id, roleId: 'receptionist', permissions: ['ops_calendar', 'fin_edit_invoice'] },
    ]);

    // Clean up OTP record if it exists in DB
    if (otpRecord) {
      await Otp.deleteOne({ _id: otpRecord._id });
    }

    // Utilize the Cookie Helper
    sendTokenResponse({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      clinicId: clinic._id,
      clinicType: clinic.clinicType, 
      defaultBranch: null,
    }, 201, res);

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// @desc    Verify OTP and Reset Password
// @route   POST /api/auth/reset-password
// ==========================================
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters long.' });

    const cleanEmail = email.toLowerCase().trim();
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose: 'PASSWORD_RESET' });

    if (!otpRecord) return res.status(400).json({ message: 'OTP expired or not found.' });

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many incorrect attempts.' });
    }

    if (hashOtp(otp) !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ message: 'User account not found.' });

    user.password = newPassword;
    user.mustChangePassword = false;
    user.status = 'Active';
    await user.save();

    await Otp.deleteOne({ _id: otpRecord._id });
    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({ message: 'An error occurred while resetting your password.' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    
    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    //  DEV BYPASS: Allow a master test code (e.g., "123456") or a global env flag in development
    const isDev = process.env.NODE_ENV !== 'production';
    const isMasterBypass = otp === '123456' || process.env.BYPASS_EMAIL_VERIFICATION === 'true';

    if (isDev && isMasterBypass) {
      console.log(`[DEV BYPASS] OTP verification bypassed for ${cleanEmail} using test code.`);
      return res.status(200).json({ message: 'OTP verified successfully (Dev Bypass).' });
    }

    // --- STANDARD OTP VERIFICATION LOGIC ---
    const otpRecord = await Otp.findOne({ email: cleanEmail, purpose });

    if (!otpRecord) return res.status(400).json({ message: 'OTP expired or not found.' });
    
    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ message: 'Too many incorrect attempts.' });
    }

    if (hashOtp(otp) !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: `Invalid OTP code. (${5 - otpRecord.attempts} attempts left)` });
    }

    res.status(200).json({ message: 'OTP verified successfully.' });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: 'Server error during verification.' });
  }
};

// ==========================================
// @desc    Login User
// @route   POST /api/auth/login
// ==========================================
const loginUser = async (req, res) => {
  const { email, password, clinicShortId } = req.body;

  try {
    const user = await User.findOne({ email })
      .populate('clinicId')
      .populate('defaultBranch', 'name branchName branchCode')
      .populate('allowedBranches', 'name branchName branchCode');

    if (user && (await user.matchPassword(password))) {
      
      if (user.clinicId?.accountStatus === 'Pending_Approval') {
        return res.status(403).json({ message: 'Your clinic account is awaiting admin approval.' });
      }
      if (user.clinicId?.accountStatus === 'Suspended') {
        return res.status(403).json({ message: 'Your clinic account has been suspended.' });
      }

      console.log("DB Clinic Object:", user.clinicId); 
        console.log("DB Clinic ID String:", user.clinicId.clinicId);
        console.log("Frontend Payload ID:", clinicShortId);

      if (user.role !== 'Administrator') {
        if (!clinicShortId) return res.status(400).json({ message: 'Clinic ID is required for staff login.' });
        if (user.clinicId?.clinicId !== clinicShortId) return res.status(401).json({ message: 'Invalid Clinic ID.' });
      }

      const payload = {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        clinicType: user.clinicId?.clinicType,
      };

      if (user.mustChangePassword) {
        return sendTokenResponse({ ...payload, requirePasswordChange: true }, 200, res);
      }

      // Utilize the new Cookie Helper
      sendTokenResponse({
        ...payload,
        clinicId: user.clinicId._id,
        clinicShortId: user.clinicId.clinicId,
        defaultBranch: user.defaultBranch?._id || null,
        branchName: user.defaultBranch?.name || null,
        branchCode: user.defaultBranch?.branchCode || null,
        allowedBranches: user.allowedBranches || [],
      }, 200, res);

    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ==========================================
// @desc    Change Password (In-App)
// @route   PUT /api/auth/password
// ==========================================
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id)
    .populate('clinicId')
    .populate('defaultBranch', 'name branchName branchCode')
    .populate('allowedBranches', 'name branchName branchCode');

  if (user && (await user.matchPassword(oldPassword))) {
    user.password = newPassword;
    user.mustChangePassword = false;
    user.status = 'Active';
    await user.save();

    // Utilize the new Cookie Helper
    sendTokenResponse({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      clinicType: user.clinicId?.clinicType,
      defaultBranch: user.defaultBranch?._id || null,
      branchName: user.defaultBranch?.name || null,
      branchCode: user.defaultBranch?.branchCode || null,
      allowedBranches: user.allowedBranches || [],
    }, 200, res);

  } else {
    res.status(401).json({ message: 'Invalid old password' });
  }
};

// ==========================================
// NEW: @desc    Logout User & Clear Cookie
// @route   POST /api/auth/logout
// ==========================================
const logoutUser = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0), // Instantly expires the cookie
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
  sendOtp,
  registerClinic,
  loginUser,
  changePassword,
  resetPasswordWithOtp,
  verifyOtp,
  logoutUser // Exported new route
};