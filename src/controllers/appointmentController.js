const Appointment = require('../models/Appointment');

// @desc    Get all appointments for the logged-in clinic
// @route   GET /api/appointments
const getAppointments = async (req, res) => {
  try {
    // SECURITY: Only fetch appointments for this clinic
    const appointments = await Appointment.find({ clinicId: req.user.clinicId });
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new appointment
// @route   POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { 
      title, patientId, phone, docId, doc, type, start, end, resourceId, status 
    } = req.body;

    // Basic Validation
    if (!patientId || !docId || !start || !end) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const appointment = await Appointment.create({
      clinicId: req.user.clinicId, // <--- Securely bind to clinic
      patientId,
      title,
      phone,
      doctorId: docId,   // Map frontend 'docId' to DB 'doctorId'
      doctorName: doc,   // Map frontend 'doc' to DB 'doctorName'
      type,
      start,
      end,
      resourceId,
      status: status || 'Scheduled'
    });

    res.status(201).json(appointment);

  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update appointment (Reschedule or Edit)
// @route   PUT /api/appointments/:id
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { start, end, resourceId, title, docId, type, status } = req.body;

    // 1. Find Appointment (Ensure it belongs to this clinic)
    let appointment = await Appointment.findOne({ _id: id, clinicId: req.user.clinicId });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // 2. Update Fields (Only update what is sent)
    if (start) appointment.start = start;
    if (end) appointment.end = end;
    if (resourceId) appointment.resourceId = resourceId;
    if (title) appointment.title = title;
    if (docId) appointment.doctorId = docId;
    if (type) appointment.type = type;
    if (status) appointment.status = status;

    await appointment.save();
    res.json(appointment);

  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOneAndDelete({ _id: id, clinicId: req.user.clinicId });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ message: 'Appointment removed' });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment
};