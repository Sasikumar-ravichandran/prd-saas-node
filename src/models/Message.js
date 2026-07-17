const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  content: { type: String, required: true },
  
  // For Patient Tagging (Optional but highly recommended)
  taggedPatient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },

  // Who has seen this message? (For read receipts)
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);