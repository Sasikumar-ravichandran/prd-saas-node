const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getInventory, addInventory, consumeStock, getLowStockAlerts, updateInventory, deleteInventory } = require('../controllers/inventoryController');

router.use(protect); // All routes protected

router.get('/', getInventory);
router.post('/', addInventory);
router.post('/:id/consume', consumeStock);
router.get('/alerts', getLowStockAlerts); // <--- Call this on your Admin Dashboard
router.put('/:id', updateInventory);
router.delete('/:id', deleteInventory);

module.exports = router;