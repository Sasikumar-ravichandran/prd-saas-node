const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');

// @desc    Get All Inventory (Filtered by Branch)
// @route   GET /api/inventory
const getInventory = async (req, res) => {
  try {
    const items = await Inventory.find({ 
      clinicId: req.user.clinicId, 
      branchId: req.branchId 
    }).sort({ name: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add New Item or Restock
// @route   POST /api/inventory
const addInventory = async (req, res) => {
  try {
    const { name, category, quantity, lowStockThreshold, expiryDate, costPerUnit } = req.body;

    // 1. Check if item exists in THIS branch
    let item = await Inventory.findOne({
      clinicId: req.user.clinicId,
      branchId: req.branchId,
      name: { $regex: new RegExp(`^${name}$`, 'i') } // Case insensitive check
    });

    if (item) {
      // UPDATE EXISTING
      item.quantity += Number(quantity);
      item.lastRestocked = Date.now();
      if(expiryDate) item.expiryDate = expiryDate;
      await item.save();
    } else {
      // CREATE NEW
      item = await Inventory.create({
        clinicId: req.user.clinicId,
        branchId: req.branchId,
        name, category, quantity, lowStockThreshold, expiryDate, costPerUnit
      });
    }

    // 2. Log the Transaction
    await InventoryLog.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId,
      itemId: item._id,
      itemName: item.name,
      action: 'Restock',
      quantityChange: quantity,
      performedBy: req.user._id,
      notes: 'Initial Add / Restock'
    });

    res.status(200).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Consume Stock (Used when a doctor uses materials)
// @route   POST /api/inventory/:id/consume
const consumeStock = async (req, res) => {
  try {
    const { quantity, reason } = req.body; // e.g. quantity: 1, reason: "Root Canal PID-1001"
    const item = await Inventory.findById(req.params.id);

    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // 1. Deduct Stock
    item.quantity -= Number(quantity);
    await item.save();

    // 2. Log Transaction
    await InventoryLog.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId,
      itemId: item._id,
      itemName: item.name,
      action: 'Consumed',
      quantityChange: -quantity,
      performedBy: req.user._id,
      notes: reason || 'Manual Consumption'
    });

    res.json(item);

  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get Low Stock Alerts (For Dashboard)
const getLowStockAlerts = async (req, res) => {
  try {
    // MongoDB Query: Find items where quantity <= lowStockThreshold
    const alerts = await Inventory.find({
      clinicId: req.user.clinicId,
      branchId: req.branchId,
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] } 
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 1. Find Item & Ensure Ownership
    const item = await Inventory.findOne({ _id: id, branchId: req.branchId });

    if (!item) {
      return res.status(404).json({ message: 'Item not found or access denied' });
    }

    // 2. Update Fields
    // We allow updating everything passed in req.body
    Object.assign(item, updates);

    // 3. Log the "Adjustment" if quantity changed (Optional but good for audit)
    // You can add logic here to compare old vs new quantity if you want strict logging

    await item.save();
    res.json(item);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const deleteInventory = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Security: Ensure item belongs to user's branch
    if (item.branchId.toString() !== req.branchId) {
      return res.status(401).json({ message: 'Not authorized to delete this item' });
    }

    await item.deleteOne();
    res.json({ message: 'Item removed' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getInventory, addInventory, consumeStock, getLowStockAlerts, updateInventory, deleteInventory };