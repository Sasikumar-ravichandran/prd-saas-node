const Appointment = require('../models/Appointment');
const { dispatchWhatsAppEvent } = require('../services/whatsappService');

//  IMPORT THE AUDIT LOGGER
const logAudit = require('../utils/auditLogger'); // Ensure this matches your actual path!

const formatApptTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

// @desc    Get all appointments (Scoped to Active Branch)
// @route   GET /api/appointments
const getAppointments = async (req, res) => {
  try {
    // SECURITY: Only fetch appointments for this clinic AND this branch
    const appointments = await Appointment.find({
      clinicId: req.user.clinicId,
      branchId: req.branchId 
    });
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

    if (!patientId || !docId || !start || !end) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const appointment = await Appointment.create({
      clinicId: req.user.clinicId,
      branchId: req.branchId, 
      patientId,
      title,
      phone,
      doctorId: docId,  
      doctorName: doc,  
      type,
      start,
      end,
      resourceId,
      status: status || 'Scheduled'
    });

    if (phone) {
      dispatchWhatsAppEvent(req.user.clinicId, 'appointment_booked', phone, {
        patientName: title.split('-')[0].trim() || 'Patient', 
        time: formatApptTime(start),
        treatment: type || 'Consultation',
        doctorName: doc || 'your doctor',
        clinicName: "Our Clinic" // Replace with req.user.clinicName if available
      });
    }

    //  AUDIT LOG
    logAudit({
      req, action: 'CREATE_APPOINTMENT', entity: 'Appointment', entityId: appointment._id,
      details: `Booked new appointment for ${title.split('-')[0].trim()} with Dr. ${doc}`
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

    let appointment = await Appointment.findOne({
      _id: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId // SECURITY CHECK
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found in this branch' });
    }

    //  BUG FIX: Calculate if the time actually changed before updating
    const isRescheduled = start && new Date(start).getTime() !== new Date(appointment.start).getTime();

    // 2. Update Fields
    if (start) appointment.start = start;
    if (end) appointment.end = end;
    if (resourceId) appointment.resourceId = resourceId;
    if (title) appointment.title = title;
    if (docId) appointment.doctorId = docId;
    if (type) appointment.type = type;
    if (status) appointment.status = status;

    await appointment.save();

    if (isRescheduled && appointment.phone) {
      dispatchWhatsAppEvent(req.user.clinicId, 'appointment_rescheduled', appointment.phone, {
        patientName: appointment.title.split('-')[0].trim(),
        time: formatApptTime(appointment.start),
        doctorName: appointment.doctorName,
        clinicName: "Our Clinic"
      });
    }

    //  AUDIT LOG
    logAudit({
      req, action: isRescheduled ? 'RESCHEDULE_APPOINTMENT' : 'UPDATE_APPOINTMENT', 
      entity: 'Appointment', entityId: appointment._id,
      details: isRescheduled 
        ? `Rescheduled appointment for ${appointment.title.split('-')[0].trim()} to ${formatApptTime(start)}`
        : `Updated appointment details for ${appointment.title.split('-')[0].trim()}`
    });

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

    const appointment = await Appointment.findOneAndDelete({
      _id: id,
      clinicId: req.user.clinicId,
      branchId: req.branchId // SECURITY CHECK
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or access denied' });
    }

    if (appointment.phone) {
      dispatchWhatsAppEvent(req.user.clinicId, 'appointment_cancelled', appointment.phone, {
        patientName: appointment.title.split('-')[0].trim(),
        time: formatApptTime(appointment.start),
        clinicName: "Our Clinic"
      });
    }

    //  AUDIT LOG
    logAudit({
      req, action: 'DELETE_APPOINTMENT', entity: 'Appointment', entityId: appointment._id,
      details: `Cancelled and deleted appointment for ${appointment.title.split('-')[0].trim()}`
    });

    res.json({ message: 'Appointment removed' });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update appointment status
// @route   PATCH /api/appointments/:id/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    //  BUG FIX: Added clinicId and branchId to prevent IDOR attacks
    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, clinicId: req.user.clinicId, branchId: req.branchId },
      { status: status },
      { new: true } 
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or access denied' });
    }

    if (appointment.phone) {
      if (status === 'Cancelled') {
        dispatchWhatsAppEvent(req.user.clinicId, 'appointment_cancelled', appointment.phone, {
          patientName: appointment.title.split('-')[0].trim(),
          time: formatApptTime(appointment.start),
          clinicName: "Our Clinic"
        });
      } else if (status === 'Completed') {
        dispatchWhatsAppEvent(req.user.clinicId, 'appointment_completed', appointment.phone, {
          patientName: appointment.title.split('-')[0].trim(),
          treatment: appointment.type,
          clinicName: "Our Clinic"
        });
      }
    }

    //  AUDIT LOG
    logAudit({
      req, action: 'UPDATE_APPOINTMENT_STATUS', entity: 'Appointment', entityId: appointment._id,
      details: `Marked appointment for ${appointment.title.split('-')[0].trim()} as ${status}`
    });

    res.json(appointment);
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  updateAppointmentStatus
};