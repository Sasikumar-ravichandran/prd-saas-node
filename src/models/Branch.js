const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  // 1. Link to the Parent Clinic
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true 
  },

  // 2. Branch Details (Renamed for clarity)
  branchName: { 
    type: String, 
    required: [true, 'Please add a branch name'] 
  }, 
  
  // 3. Unique Code (e.g., BID-001)
  branchCode: { 
    type: String, 
    required: true, 
    uppercase: true 
  }, 

  address: { type: String },
  phone: { type: String },

  // 4. Status
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Compound Index: Ensures 'branchCode' is unique PER CLINIC
// (Clinic A and Clinic B can both have 'BID-001', but Clinic A cannot have two 'BID-001's)
BranchSchema.index({ clinicId: 1, branchCode: 1 }, { unique: true });

module.exports = mongoose.model('Branch', BranchSchema);