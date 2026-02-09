const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  
  // In a real app, this would be hashed (bcrypt). 
  // For now, we store it simply to get the CRUD working.
  password: { type: String, default: '123456' }, 
  
  role: { 
    type: String, 
    enum: ['Administrator', 'Doctor', 'Receptionist', 'Nurse'], 
    default: 'Receptionist' 
  },
  
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Pending'], 
    default: 'Active' 
  },

  // Link to Clinic (for multi-tenancy later)
  // clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);