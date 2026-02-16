const User = require('../models/User');

// @desc    Get all users (Staff) for MY Clinic
// @route   GET /api/users
// @access  Private (Admin Only)
const getUsers = async (req, res) => {
    try {
        if (!req.user || !req.user.clinicId) {
            return res.json([]);
        }

        // 1. Get Users for the Clinic
        // We populate 'defaultBranch' so the frontend table can show the Branch Name
        const users = await User.find({ clinicId: req.user.clinicId })
            .select('-password') 
            .populate('defaultBranch', 'branchName name branchCode') // Get name & code
            .populate('allowedBranches', 'branchName name');

        res.json(users);

    } catch (error) {
        console.error("Get Users Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a new staff member
// @route   POST /api/users
// @access  Private (Admin Only)
const createUser = async (req, res) => {
    try {
        const { 
            name, email, role, status, mobile, password,
            allowedBranches, defaultBranch 
        } = req.body;

        // 1. Automatic Branch Assignment
        // Priority: Frontend Selection -> Admin's Current Branch -> Admin's Default
        const targetBranch = defaultBranch || req.branchId || req.user.defaultBranch;

        if (!targetBranch) {
             return res.status(400).json({ message: "System Error: No active branch found." });
        }

        // 2. Check Duplicates
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // 3. Create User
        const user = await User.create({
            clinicId: req.user.clinicId,
            name,
            email,
            role,
            status: status || 'Active',
            mobile, // <--- Saving Mobile
            
            // Branch Logic
            defaultBranch: targetBranch, 
            allowedBranches: allowedBranches && allowedBranches.length > 0 
                             ? allowedBranches 
                             : [targetBranch],
            
            password,
            mustChangePassword: true,
        });

        // 4. CRITICAL: Populate the branch details before sending response
        // This ensures your Table shows the Branch Name immediately without refreshing
        await user.populate('defaultBranch', 'branchName name branchCode');

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            mobile: user.mobile, // <--- Returning Mobile
            defaultBranch: user.defaultBranch, // <--- Returning Populated Branch Object
            message: 'Staff member created successfully'
        });

    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update staff details
// @route   PUT /api/users/:id
// @access  Private (Admin Only)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findOne({ 
            _id: id, 
            clinicId: req.user.clinicId 
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update Standard Fields
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.role = req.body.role || user.role;
        user.status = req.body.status || user.status;
        user.mobile = req.body.mobile || user.mobile;

        // Update Branch Logic
        if (req.body.allowedBranches) {
            user.allowedBranches = req.body.allowedBranches;
        }

        if (req.body.defaultBranch) {
            user.defaultBranch = req.body.defaultBranch;

            // Safety: Ensure new default branch is in allowed list
            const hasAccess = user.allowedBranches.some(
                b => b.toString() === req.body.defaultBranch
            );
            if (!hasAccess) {
                user.allowedBranches.push(req.body.defaultBranch);
            }
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        // Populate for Frontend
        await updatedUser.populate('defaultBranch', 'branchName name branchCode');

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            status: updatedUser.status,
            mobile: updatedUser.mobile,
            defaultBranch: updatedUser.defaultBranch,
            message: "User updated successfully"
        });

    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin Only)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findOne({ 
            _id: id, 
            clinicId: req.user.clinicId 
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete yourself.' });
        }

        await user.deleteOne();

        res.json({ message: 'User removed successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };