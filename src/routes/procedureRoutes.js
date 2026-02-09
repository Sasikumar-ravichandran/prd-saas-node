const express = require('express');
const router = express.Router();
const { 
  getProcedures, 
  createProcedure, 
  updateProcedure, 
  deleteProcedure 
} = require('../controllers/procedureController');

// 1. Import the middleware
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Apply protection to all routes in this file
router.use(protect, adminOnly);

router.route('/')
  .get(getProcedures)
  .post(createProcedure);

router.route('/:id')
  .put(updateProcedure)
  .delete(deleteProcedure);

module.exports = router;