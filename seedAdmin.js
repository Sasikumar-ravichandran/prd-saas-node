require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../server/src/models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    const email = 'support@klinichub.com';
    const plainTextPassword = 'Sasikumar@28'; 

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('Super Admin already exists in the database! Delete it from MongoDB first.');
      process.exit(0);
    }

    // ⚡️ Create account directly with PLAIN TEXT password. 
    // Your UserSchema.pre('save') will encrypt it automatically!
    const superAdmin = await User.create({
      name: 'Sasikumar Ravi',
      fullName: 'Sasikumar Ravi',
      email: email,
      password: plainTextPassword, // 👈 Just pass the plain string!
      role: 'SuperAdmin',
      isSuperAdmin: true,
      clinicId: null, 
      defaultBranch: null,
      allowedBranches: [],
    });

    console.log(`✅ Success! Super Admin created for: ${superAdmin.email}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error);
    process.exit(1);
  }
};

createAdmin();