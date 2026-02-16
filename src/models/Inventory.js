const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  // --- 1. OWNERSHIP ---
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  // --- 2. ITEM DETAILS ---
  name: { type: String, required: true, trim: true }, // e.g., "N95 Masks"
  category: { 
    type: String, 
    enum: ['Consumable', 'Instrument', 'Equipment', 'Medicine'], 
    default: 'Consumable' 
  },
  sku: { type: String, trim: true }, // Barcode/Stock Keeping Unit
  supplier: { type: String, trim: true },

  // --- 3. STOCK LEVELS ---
  quantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs' }, // pcs, boxes, ml, kg
  
  // --- 4. ALERTS (For your Dashboard) ---
  lowStockThreshold: { type: Number, default: 10 }, // Alert if quantity < 10
  expiryDate: { type: Date }, // Track nearest expiry

  // --- 5. FINANCIALS ---
  costPerUnit: { type: Number, default: 0 }, // For profit calculation
  lastRestocked: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound Index: Names must be unique per branch (Branch A can have 'Gloves', Branch B can have 'Gloves')
InventorySchema.index({ clinicId: 1, branchId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);