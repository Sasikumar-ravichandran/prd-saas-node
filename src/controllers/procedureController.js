const Procedure = require('../models/Procedure');

// @desc    Get all procedures
// @route   GET /api/procedures
const getProcedures = async (req, res) => {
  try {
    const procedures = await Procedure.find().sort({ code: 1 }); // Sort alphabetically by code
    res.json(procedures);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

const createProcedure = async (req, res) => {
  try {
    // 1. Destructure ONLY what you send from FE
    // (code, name, price, commission, active)
    const { code, name, price, commission, active } = req.body;

    // 2. Check for Duplicates (Prevents 500 Error)
    const exists = await Procedure.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: `Procedure code '${code}' already exists.` });
    }

    // 3. Create
    const procedure = await Procedure.create({
      code,
      name,
      price, 
      commission, // "20" -> 20 (Mongoose casts automatically)
      
      // DEFAULTS (Since FE doesn't send them anymore)
      tax: 0,     
      labCost: 0,
      
      // MAPPING (FE 'active' -> BE 'isActive')
      isActive: active !== undefined ? active : true 
    });

    res.status(201).json(procedure);

  } catch (error) {
    // Better Error Logging
    console.error("Create Procedure Error:", error);
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Duplicate Procedure Code.' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update procedure
// @route   PUT /api/procedures/:id
const updateProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    const procedure = await Procedure.findById(id);

    if (!procedure) return res.status(404).json({ message: 'Procedure not found' });

    // Update fields ONLY if they are sent
    if (req.body.code) procedure.code = req.body.code;
    if (req.body.name) procedure.name = req.body.name;
    if (req.body.price !== undefined) procedure.price = req.body.price;
    if (req.body.commission !== undefined) procedure.commission = req.body.commission;
    
    // Handle the Status Toggle
    if (req.body.active !== undefined) procedure.isActive = req.body.active;
    if (req.body.isActive !== undefined) procedure.isActive = req.body.isActive; // Handle both cases

    const updatedProcedure = await procedure.save();
    res.json(updatedProcedure);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};


const deleteProcedure = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check if it exists
    const procedure = await Procedure.findById(id);

    if (!procedure) {
      return res.status(404).json({ message: 'Procedure not found' });
    }

    // 2. Perform Delete
    await procedure.deleteOne(); // or Procedure.findByIdAndDelete(id);

    res.json({ message: 'Procedure removed successfully' });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getProcedures, createProcedure, updateProcedure, deleteProcedure };