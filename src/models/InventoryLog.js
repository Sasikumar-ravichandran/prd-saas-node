const mongoose = require('mongoose');

const InventoryLogSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  itemName: String, // Snapshot name in case item is deleted

  action: { 
    type: String, 
    enum: ['Restock', 'Consumed', 'Adjustment', 'Expired', 'Return'], 
    required: true 
  },
  
  quantityChange: { type: Number, required: true }, // +10 or -5
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who did it?
  
  notes: String // e.g., "Used for Patient PID-1005"
}, { timestamps: true });

module.exports = mongoose.model('InventoryLog', InventoryLogSchema);