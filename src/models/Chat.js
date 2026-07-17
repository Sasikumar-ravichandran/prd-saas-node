const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  
  // 'private' = 1 on 1, 'branch' = specific branch group, 'clinic' = everyone
  type: { type: String, enum: ['private', 'branch', 'clinic'], required: true },
  
  // Only used if it's a group chat (e.g., "Egmore Staff")
  chatName: { type: String }, 
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }, // If it's a branch group

  // Who is in this chat?
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // To show "Latest message" in the sidebar without fetching all messages
  latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);