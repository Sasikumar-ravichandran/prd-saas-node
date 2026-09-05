const User = require('../models/User');
const bcrypt = require('bcryptjs'); // Added incase it was missing in this scope for changePassword

//  IMPORT THE AUDIT LOGGER
const logAudit = require('../utils/auditLogger'); // Adjust path if needed

// @desc    Get all users
const getUsers = async (req, res) => {
    try {
        // 1. Capture Query Parameters (Added Pagination)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        // 2. Base query: always filter by clinicId
        let query = { clinicId: req.user.clinicId };

        // 3. Role Filter
        if (req.query.role) {
            query.role = { $regex: new RegExp(`^${req.query.role}$`, 'i') };
        }

        // 4. Search Filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { role: { $regex: search, $options: 'i' } }
            ];
        }

        // 5. Execute Paginated Query
        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('-password')
            .populate('defaultBranch', 'branchName name branchCode')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // 6. Get Total Count for the Frontend Pagination UI
        const total = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalCount: total
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new staff member
const createUser = async (req, res) => {
    try {
        const {
            name, fullName, email, role, status, mobile, password,
            allowedBranches, defaultBranch, doctorConfig
        } = req.body;

        // 1. Branch Validation
        const targetBranch = defaultBranch || req.branchId || req.user.defaultBranch;
        if (!targetBranch) return res.status(400).json({ message: "No active branch found." });

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        // 2. Create User
        const user = await User.create({
            clinicId: req.user.clinicId,
            name: fullName || name,
            fullName: fullName || name,
            email,
            role,
            status: status || 'Active',
            mobile,
            password: password || '123456', 
            mustChangePassword: true,
            defaultBranch: targetBranch,
            allowedBranches: allowedBranches && allowedBranches.length > 0 ? allowedBranches : [targetBranch],
            doctorConfig: role === 'Doctor' ? doctorConfig : undefined
        });

        // 3. POPULATE BEFORE RESPONDING
        await user.populate('defaultBranch', 'branchName name branchCode');

        const userResponse = user.toObject();
        delete userResponse.password; 

        //  AUDIT LOG
        logAudit({
            req, 
            action: 'CREATE_USER', 
            entity: 'User', 
            entityId: user._id,
            details: `Created new staff profile for ${user.fullName} (${user.role})`
        });

        res.status(201).json({ ...userResponse, message: 'User created successfully' });

    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update staff details
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ _id: id, clinicId: req.user.clinicId });

        if (!user) return res.status(404).json({ message: 'User not found' });

        // 1. Update Basic Fields
        if (req.body.fullName || req.body.name) user.fullName = req.body.fullName || req.body.name;
        user.name = req.body.name || req.body.fullName || user.name;
        if (req.body.email) user.email = req.body.email;
        if (req.body.mobile) user.mobile = req.body.mobile;
        if (req.body.role) user.role = req.body.role;
        if (req.body.status) user.status = req.body.status;

        // 2. Update Complex Fields (Doctor Config)
        if (user.role === 'Doctor' && req.body.doctorConfig) {
            user.doctorConfig = { ...user.doctorConfig, ...req.body.doctorConfig };
        }

        // 3. Update Branch & Payroll configurations
        if (req.body.defaultBranch) user.defaultBranch = req.body.defaultBranch;
        if (req.body.baseSalary !== undefined) user.baseSalary = req.body.baseSalary;
        if (req.body.commissionRate !== undefined) user.commissionRate = req.body.commissionRate;

        const updatedUser = await user.save();
        await updatedUser.populate('defaultBranch', 'branchName name branchCode');

        const responseObj = updatedUser.toObject();
        delete responseObj.password;

        //  AUDIT LOG
        logAudit({
            req, 
            action: 'UPDATE_USER', 
            entity: 'User', 
            entityId: updatedUser._id,
            details: `Updated staff details for user ${updatedUser.fullName}`
        });

        res.json({ ...responseObj, message: "User updated successfully" });

    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userToDelete = await User.findOne({ _id: req.params.id, clinicId: req.user.clinicId });
        if (!userToDelete) return res.status(404).json({ message: 'User not found' });

        const userName = userToDelete.fullName;
        await userToDelete.deleteOne();

        //  AUDIT LOG
        logAudit({
            req, 
            action: 'DELETE_USER', 
            entity: 'User', 
            entityId: req.params.id,
            details: `Permanently removed staff member: ${userName}`
        });

        res.json({ message: 'User removed' });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private
const updateMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.body.fullName || req.body.name) {
            user.fullName = req.body.fullName || req.body.name;
        }

        if (req.body.mobile !== undefined || req.body.phone !== undefined) {
            user.mobile = req.body.mobile || req.body.phone;
        }

        const updatedUser = await user.save();
        updatedUser.password = undefined; 

        //  AUDIT LOG
        logAudit({
            req, 
            action: 'UPDATE_OWN_PROFILE', 
            entity: 'User', 
            entityId: updatedUser._id,
            details: `User updated their own personal profile details`
        });

        res.json(updatedUser);

    } catch (error) {
        console.error("Update Me Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Change Password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        // 1. ⚡️ FIXED: Change 'currentPassword' to 'oldPassword' to match React frontend
        const { oldPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Verify current password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // 3. Update password and remove the force-change flag
        user.password = newPassword; 
        user.mustChangePassword = false; // ⚡️ ADDED: So they don't get stuck in a loop!

        await user.save(); // Note: If you have a Mongoose pre-save hook for hashing, this automatically hashes it!

        // AUDIT LOG
        logAudit({
            req, 
            action: 'CHANGE_PASSWORD', 
            entity: 'User', 
            entityId: user._id,
            details: `User successfully changed their account password`
        });

        // 4. ⚡️ FIXED: Return the full user object so React can update localStorage
        const payload = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            clinicId: user.clinicId, 
            defaultBranch: user.defaultBranch || null,
            allowedBranches: user.allowedBranches || [],
        };

        res.json(payload);

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUsers, 
    createUser, 
    updateUser, 
    deleteUser, 
    getMe,
    updateMe,
    changePassword
};