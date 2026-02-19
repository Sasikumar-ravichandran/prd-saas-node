const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Patient = require('../models/Patient');
const Expense = require('../models/Expense')
const mongoose = require('mongoose');

const getDoctorStats = async (req, res) => {
    try {
        const doctorId = req.user._id;
        const doctorName = req.user.fullName || req.user.name; // Use fullName
        const clinicId = req.user.clinicId;
        const branchId = req.branchId;

        // 1. Time Range (Today)
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

        // 2. Fetch Schedule (Appointments for THIS doctor at THIS branch)
        const appointments = await Appointment.find({
            clinicId,
            branchId,
            doctorId,
            start: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'Cancelled' }
        })
            .populate('patientId', 'fullName gender age patientId medicalConditions primaryConcern notes mobile totalCost totalPaid treatmentPlan')
            .sort({ start: 1 });

        // 3. Identify "Active" Appt
        let activeAppt = appointments.find(a => a.status === 'In Progress');

        // ⚡️ NEW: If no formal appointment is active, check for "Walk-ins" or patients 
        // who have a treatment marked "In Progress" today assigned to this doctor.
        let clinicalActivePatient = null;
        if (!activeAppt) {
            clinicalActivePatient = await Patient.findOne({
                clinicId,
                branchId,
                $or: [{ assignedDoctor: doctorName }, { assignedDoctor: doctorId }],
                'treatmentPlan.status': 'In Progress' // They are currently being worked on
            }).select('fullName gender age patientId medicalConditions primaryConcern notes treatmentPlan');
        }

        let viewMode = 'active';
        let activePatientData = null;

        // 4. Format the Active Patient Data
        if (activeAppt) {
            // From Appointment
            activePatientData = {
                id: activeAppt.patientId?._id,
                name: activeAppt.patientId?.fullName || activeAppt.title,
                pid: activeAppt.patientId?.patientId || 'Walk-in',
                age: activeAppt.patientId?.age || '-',
                gender: activeAppt.patientId?.gender || '-',
                conditions: activeAppt.patientId?.medicalConditions || [],
                complaint: activeAppt.patientId?.primaryConcern || activeAppt.type,
                notes: activeAppt.patientId?.notes || 'No notes available.',
                status: activeAppt.status,
            };
        } else if (clinicalActivePatient) {
            // ⚡️ From Clinical Record (No Appointment)
            activePatientData = {
                id: clinicalActivePatient._id,
                name: clinicalActivePatient.fullName,
                pid: clinicalActivePatient.patientId,
                age: clinicalActivePatient.age || '-',
                gender: clinicalActivePatient.gender || '-',
                conditions: clinicalActivePatient.medicalConditions || [],
                complaint: clinicalActivePatient.primaryConcern || 'In Progress Treatment',
                notes: clinicalActivePatient.notes || 'No notes available.',
                status: 'In Progress'
            };
        } else {
            // No one is active. Find the next scheduled appointment.
            activeAppt = appointments.find(a => a.status === 'Scheduled');
            viewMode = 'idle';
            if (activeAppt) {
                activePatientData = {
                    id: activeAppt.patientId?._id,
                    name: activeAppt.patientId?.fullName || activeAppt.title,
                    pid: activeAppt.patientId?.patientId || 'Walk-in',
                    age: activeAppt.patientId?.age || '-',
                    gender: activeAppt.patientId?.gender || '-',
                    conditions: activeAppt.patientId?.medicalConditions || [],
                    complaint: activeAppt.patientId?.primaryConcern || activeAppt.type,
                    notes: activeAppt.patientId?.notes || 'No notes available.',
                    status: activeAppt.status
                };
            }
        }

        // 5. Calculate Personal Daily Revenue (Simple count for now)
        const patientsSeenCount = appointments.filter(a => a.status === 'Completed').length;

        // 6. Format Schedule for the right-side timeline
        const schedule = appointments.map(appt => {
            const patient = appt.patientId || {};

            // 1. Find all active treatments for this patient
            const activeTreatments = (patient.treatmentPlan || []).filter(t => t.status !== 'Completed');


            // 2. Build the "Smart" Treatment Text
            let smartTreatmentText = appt.type || 'Consultation'; // Default to appointment type

            if (activeTreatments.length > 0) {
                // If they have treatments, map them like "Root Canal (Tooth 12), Extraction"
                smartTreatmentText = activeTreatments.map(t =>
                    `${t.procedure} ${t.tooth ? `(T${t.tooth})` : ''}`
                ).join(', ');
            }

            return {
                id: appt._id,
                pid: patient.patientId,
                patientMongoId: patient._id,
                time: new Date(appt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                startTime: appt.start,
                name: patient.fullName || appt.title || 'Walk-in',
                type: smartTreatmentText, // ⚡️ Now sends the active treatments OR the fallback type
                originalType: appt.type,  // Keep the original just in case
                activeTreatments: activeTreatments, // Send the array to the frontend for UI styling
                status: appt.status,
                age: patient.age,
                gender: patient.gender,
                conditions: patient.medicalConditions,
                notes: patient.notes
            };
        });

        // 7. Get History (Last 2 completed treatments)
        let patientHistory = [];
        if (activePatientData && activePatientData.id) {
            const patient = await Patient.findById(activePatientData.id).select('treatmentPlan');
            if (patient && patient.treatmentPlan) {
                patientHistory = patient.treatmentPlan
                    .filter(t => t.status === 'Completed')
                    .slice(-2);
            }
        }

        res.json({
            doctorName: doctorName,
            stats: {
                patientsSeen: patientsSeenCount,
                remaining: appointments.length - patientsSeenCount - (activePatientData && viewMode === 'active' ? 1 : 0)
            },
            schedule,
            activePatient: activePatientData,
            viewMode,
            history: patientHistory
        });

    } catch (error) {
        console.error("Doctor Dashboard Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get Receptionist Dashboard Data (Scoped to Branch)
const getReceptionStats = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const branchId = req.branchId; // <--- 1. Get Active Branch

        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const now = new Date();

        // --- 1. DOCTOR STATUS (TRAFFIC LIGHTS) ---
        // Only show doctors assigned to THIS branch
        const doctors = await User.find({
            clinicId,
            role: { $in: ['Doctor', 'doctor'] },
            allowedBranches: branchId // <--- 2. FILTER DOCTORS
        }).select('name _id');

        // Check Calendar (Appointments in THIS branch)
        const activeAppointments = await Appointment.find({
            clinicId,
            branchId, // <--- 3. FILTER APPOINTMENTS
            start: { $lte: now },
            end: { $gte: now },
            status: 'In Progress'
        }).populate('patientId', 'fullName');

        // Check Clinical Charts (Patients active in THIS branch)
        const activePatients = await Patient.find({
            clinicId,
            branchId, // <--- 4. FILTER PATIENTS
            'treatmentPlan.status': 'In Progress',
            updatedAt: { $gte: startOfDay }
        }).select('fullName assignedDoctor treatmentPlan');

        const doctorStatus = doctors.map(doc => {
            const activeAppt = activeAppointments.find(a => a.doctorId.toString() === doc._id.toString());
            const clinicalPatient = activePatients.find(p =>
                p.assignedDoctor === doc.name &&
                p.treatmentPlan.some(t => t.status === 'In Progress')
            );

            let status = 'Available';
            let patientName = '-';
            let timer = '-';

            if (activeAppt) {
                status = 'Busy';
                patientName = activeAppt.patientId?.fullName || activeAppt.title || 'Walk-in';
                timer = 'Appt';
            } else if (clinicalPatient) {
                status = 'Busy';
                patientName = clinicalPatient.fullName;
                timer = 'Chart';
            }

            return { id: doc._id, doctor: doc.name, status, patient: patientName, timer };
        });

        // --- 2. TODAY'S FLOW (Queue for THIS Branch) ---
        const appointmentsToday = await Appointment.find({
            clinicId,
            branchId, // <--- 5. FILTER QUEUE
            start: { $gte: startOfDay, $lte: endOfDay }
        })
            .populate('patientId', 'fullName patientId totalCost totalPaid')
            .populate('doctorId', 'name')
            .sort({ start: 1 });

        const todayFlow = await Promise.all(appointmentsToday.map(async (appt) => {
            let patient = appt.patientId;
            // Smart Search (Scoped to Branch)
            if (!patient && appt.title) {
                const foundPatient = await Patient.findOne({
                    clinicId,
                    branchId, // <--- 6. FILTER SMART SEARCH
                    fullName: new RegExp(`^${appt.title.trim()}$`, 'i')
                });
                if (foundPatient) patient = foundPatient;
            }
            patient = patient || {};

            const cost = patient.totalCost || 0;
            const paid = patient.totalPaid || 0;
            const due = cost - paid;

            let payStatus = 'Unbilled';
            if (patient._id) {
                if (cost > 0 && due <= 0) payStatus = 'Paid';
                else if (cost > 0 && due > 0) payStatus = 'Pending';
            }

            return {
                _id: appt._id,
                time: new Date(appt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                name: patient.fullName || appt.title || 'Walk-in',
                displayId: patient.patientId || '',
                mongoId: patient._id || null,
                doc: appt.doctorId?.name || 'Unassigned',
                status: appt.status || 'Scheduled',
                payStatus: payStatus,
                dueAmount: due
            };
        }));

        // --- 3. CASH DRAWER (Money collected in THIS Branch) ---
        const todaysPayments = await Payment.find({
            clinicId,
            branchId, // <--- 7. FILTER CASH DRAWER
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        const cashDrawer = {
            total: todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
            cash: todaysPayments.filter(p => p.method === 'Cash').reduce((sum, p) => sum + (p.amount || 0), 0),
            online: todaysPayments.filter(p => ['UPI', 'GPay', 'Card', 'NetBanking'].includes(p.method)).reduce((sum, p) => sum + (p.amount || 0), 0),
        };

        res.json({ doctorStatus, todayFlow, cashDrawer, recallList: [] });

    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// @desc    Get Admin Dashboard Data (Scoped to Branch)
const getAdminStats = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const branchId = req.branchId; // <--- 1. Get Active Branch

        const now = new Date();

        // 1. Time Ranges
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // 2. REVENUE (Money In) - Current Month [Scoped to Branch]
        const currentMonthPayments = await Payment.find({
            clinicId,
            branchId, // <--- FILTER
            createdAt: { $gte: startOfMonth }
        });
        const revenueMonth = currentMonthPayments.reduce((acc, p) => acc + p.amount, 0);

        // 3. EXPENSES (Money Out) - Current Month [Scoped to Branch]
        const currentMonthExpenses = await Expense.find({
            clinicId,
            branchId, // <--- FILTER
            date: { $gte: startOfMonth }
        });
        const expenseMonth = currentMonthExpenses.reduce((acc, e) => acc + e.amount, 0);

        // 4. NET PROFIT & GROWTH
        const netProfit = revenueMonth - expenseMonth;

        const lastMonthPayments = await Payment.find({
            clinicId,
            branchId, // <--- FILTER
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });
        const revenueLastMonth = lastMonthPayments.reduce((acc, p) => acc + p.amount, 0);

        let growthPercent = 0;
        if (revenueLastMonth > 0) growthPercent = ((revenueMonth - revenueLastMonth) / revenueLastMonth) * 100;
        else if (revenueMonth > 0) growthPercent = 100;

        // 5. EXPENSE BREAKDOWN (Aggregate by Category) [Scoped to Branch]
        const expenseBreakdown = await Expense.aggregate([
            {
                $match: {
                    clinicId: new mongoose.Types.ObjectId(req.user.clinicId),
                    branchId: new mongoose.Types.ObjectId(branchId), // <--- FILTER
                    date: { $gte: startOfMonth }
                }
            },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } }
        ]);

        // 6. PATIENT METRICS [Scoped to Branch]
        const totalPatients = await Patient.countDocuments({
            clinicId,
            branchId, // <--- FILTER
            isActive: true
        });
        const newPatientsMonth = await Patient.countDocuments({
            clinicId,
            branchId, // <--- FILTER
            createdAt: { $gte: startOfMonth }
        });

        // 7. TODAY'S REVENUE [Scoped to Branch]
        const todaysPayments = await Payment.find({
            clinicId,
            branchId, // <--- FILTER
            createdAt: { $gte: startOfDay }
        });
        const revenueToday = todaysPayments.reduce((acc, p) => acc + p.amount, 0);

        // 8. MIXED TRANSACTIONS STREAM (Payments + Expenses) [Scoped to Branch]
        const recentPayments = await Payment.find({ clinicId, branchId }) // <--- FILTER
            .sort({ createdAt: -1 }).limit(10).populate('patientId', 'fullName').lean();

        const recentExpenses = await Expense.find({ clinicId, branchId }) // <--- FILTER
            .sort({ date: -1 }).limit(10).lean();

        let mixedTransactions = [
            ...recentPayments.map(t => ({
                id: t.receiptNumber || 'PAY',
                details: t.patientId?.fullName || 'Unknown',
                amount: t.amount,
                method: t.method,
                date: t.createdAt,
                category: 'Patient Payment',
                type: 'Income'
            })),
            ...recentExpenses.map(e => ({
                id: 'EXP',
                details: e.vendor || e.title,
                amount: e.amount,
                method: e.paymentMethod,
                date: e.date,
                category: e.category,
                type: 'Expense'
            }))
        ];

        // Sort combined list by date (newest first) and take true top 10
        mixedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        mixedTransactions = mixedTransactions.slice(0, 10);

        // 9. DOCTOR PERFORMANCE [Scoped to Branch]
        const performanceStats = await Appointment.aggregate([
            {
                $match: {
                    clinicId: new mongoose.Types.ObjectId(req.user.clinicId),
                    branchId: new mongoose.Types.ObjectId(branchId), // <--- FILTER
                    status: 'Completed',
                    start: { $gte: startOfMonth }
                }
            },
            { $group: { _id: "$doctorName", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            financials: {
                today: revenueToday,
                month: revenueMonth,
                lastMonth: revenueLastMonth,
                growth: growthPercent.toFixed(1),
                expenses: expenseMonth,
                profit: netProfit
            },
            expenseAnalysis: expenseBreakdown,
            patients: {
                total: totalPatients,
                newThisMonth: newPatientsMonth
            },
            transactions: mixedTransactions,
            performance: performanceStats
        });

    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { getReceptionStats, getDoctorStats, getAdminStats };