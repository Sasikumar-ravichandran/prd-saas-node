const User = require('../models/User');

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

        // ⚡️ Return the data structured exactly like your getPatients response
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
            password: password || '123456', // Default password
            mustChangePassword: true,
            defaultBranch: targetBranch,
            allowedBranches: allowedBranches && allowedBranches.length > 0 ? allowedBranches : [targetBranch],
            doctorConfig: role === 'Doctor' ? doctorConfig : undefined
        });

        // 3. ⚡️ POPULATE BEFORE RESPONDING
        // This ensures the frontend gets the branch NAME, not just the ID
        await user.populate('defaultBranch', 'branchName name branchCode');

        // 4. ⚡️ SEND EVERYTHING
        // user.toObject() converts the Mongoose doc to a plain JS object so we don't miss anything
        const userResponse = user.toObject();
        delete userResponse.password; // Security: remove password

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

        // 3. Update Branch
        if (req.body.defaultBranch) user.defaultBranch = req.body.defaultBranch;
        if (req.body.baseSalary !== undefined) user.baseSalary = req.body.baseSalary;
        if (req.body.commissionRate !== undefined) user.commissionRate = req.body.commissionRate;
        // 4. Save
        const updatedUser = await user.save();

        // 5. ⚡️ POPULATE AGAIN (Critical Step)
        await updatedUser.populate('defaultBranch', 'branchName name branchCode');

        // 6. ⚡️ SEND EVERYTHING (The Fix)
        // Instead of manually picking fields, we send the whole object.
        const responseObj = updatedUser.toObject();
        delete responseObj.password;

        res.json({ ...responseObj, message: "User updated successfully" });

    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

const deleteUser = async (req, res) => {
    try {
        await User.deleteOne({ _id: req.params.id, clinicId: req.user.clinicId });
        res.json({ message: 'User removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


const getMe = async (req, res) => {
    try {
        // req.user._id is populated by your authMiddleware
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

        // ⚡️ FIXED: Map incoming data to the correct Model fields (fullName and mobile)
        if (req.body.fullName || req.body.name) {
            user.fullName = req.body.fullName || req.body.name;
        }

        if (req.body.mobile !== undefined || req.body.phone !== undefined) {
            user.mobile = req.body.mobile || req.body.phone;
        }

        const updatedUser = await user.save();

        updatedUser.password = undefined; // Hide password from response
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
        const { currentPassword, newPassword } = req.body;

        // Select '+password' because schemas usually exclude it by default
        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // 2. Hash and save new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};


module.exports = {
    getUsers, createUser, updateUser, deleteUser, getMe,
    updateMe,
    changePassword
};