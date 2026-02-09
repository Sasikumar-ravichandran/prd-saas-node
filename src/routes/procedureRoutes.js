const express = require('express');
const router = express.Router();
const { 
  getProcedures, 
  createProcedure, 
  updateProcedure, 
  deleteProcedure 
} = require('../controllers/procedureController');

router.route('/')
  .get(getProcedures)
  .post(createProcedure);

router.route('/:id')
  .put(updateProcedure)
  .delete(deleteProcedure);

module.exports = router;