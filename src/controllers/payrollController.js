const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');

const getPayrollReport = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const branchId = req.branchId;

        const { mode, month, year, startDate, endDate } = req.query;

        let start, end, nextMonthStart, nextMonthEnd;
        
        // Safely parse integers so our regex builder never fails
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();

        // Date Logic
        if (mode === 'custom') {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            nextMonthStart = new Date(end);
            nextMonthEnd = new Date(end);
            nextMonthEnd.setDate(nextMonthEnd.getDate() + 30);
        } else {
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59);
            nextMonthStart = new Date(y, m, 1);
            nextMonthEnd = new Date(y, m + 1, 0, 23, 59, 59);
        }

        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

        // --- 0. FETCH ATTENDANCE DATA (Bulletproofed) ---
        let dateFilter = {};

        if (mode === 'custom') {
            const startStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`;
            const endStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}-${end.getDate().toString().padStart(2, '0')}`;
            dateFilter = { $gte: startStr, $lte: endStr };
        } else {
            // ⚡️ FIX 1: Uses the safely parsed 'y' and 'm' numbers
            const padMonth = m.toString().padStart(2, '0');
            dateFilter = { $regex: `^${y}-${padMonth}` };
        }

        // ⚡️ FIX 2: Build strict query including branchId
        const attendanceQuery = { clinicId, date: dateFilter };
        if (branchId) attendanceQuery.branchId = branchId; 

        const attendanceRecords = await Attendance.find(attendanceQuery);

        // --- 1. PAYROLL MATH & PERFORMANCE METRICS ---
        const staffMembers = await User.find({ clinicId, allowedBranches: branchId });

        const payrollData = await Promise.all(staffMembers.map(async (staff) => {

            const roleLower = staff.role ? staff.role.trim().toLowerCase() : '';
            if (roleLower === 'admin' || roleLower === 'administrator' || roleLower === 'owner') {
                return null; 
            }

            const baseSalary = staff.baseSalary || 0;
            const commissionRate = staff.commissionRate || 0;

            // --- ⚡️ FIX 3: BULLETPROOF ATTENDANCE MATH ---
            const staffAttendance = attendanceRecords.filter(a => a.userId.toString() === staff._id.toString());

            // Helper function to safely read status strings from DB
            const getSafeStatus = (record) => record.status ? record.status.trim().toLowerCase() : '';

            const unpaidLeaves = staffAttendance.filter(a => getSafeStatus(a) === 'absent' || getSafeStatus(a) === 'unpaid leave').length;
            const halfDays = staffAttendance.filter(a => getSafeStatus(a) === 'half-day').length;
            const paidLeaves = staffAttendance.filter(a => getSafeStatus(a) === 'paid leave').length;
            const presents = staffAttendance.filter(a => getSafeStatus(a) === 'present').length;
            const weeklyOffs = staffAttendance.filter(a => getSafeStatus(a) === 'weekly off').length;

            const dailyWage = baseSalary / daysInMonth;
            const leaveDeductions = (unpaidLeaves * dailyWage) + (halfDays * (dailyWage / 2));
            const adjustedBaseSalary = Math.max(0, baseSalary - leaveDeductions);

            let compType = 'Unpaid';
            if (baseSalary > 0 && commissionRate > 0) compType = `₹${baseSalary.toLocaleString()} + ${commissionRate}%`;
            else if (baseSalary > 0) compType = `Fixed (₹${baseSalary.toLocaleString()})`;
            else if (commissionRate > 0) compType = `${commissionRate}% Commission`;


            // FRONT DESK LOGIC
            if (roleLower === 'receptionist' || roleLower === 'staff' || roleLower === 'manager') {
                return {
                    staffId: staff._id,
                    name: staff.fullName || staff.name,
                    role: staff.role || 'Staff',
                    compType: baseSalary > 0 ? `Fixed (₹${baseSalary.toLocaleString()})` : 'Not Set',
                    baseSalary: baseSalary,
                    payoutDue: adjustedBaseSalary,
                    attendanceSummary: { unpaidLeaves, halfDays, leaveDeductions, paidLeaves, presents, weeklyOffs },
                    metrics: null
                };
            }

            // DOCTOR LOGIC 
            else if (roleLower === 'doctor' || roleLower === 'dentist' || roleLower === 'specialist') {
                const appointments = await Appointment.find({
                    doctorId: staff._id,
                    status: 'Completed',
                    start: { $gte: start, $lte: end }
                }).populate('patientId', 'fullName');

                let totalRevenueGenerated = 0;
                let totalCommission = 0;
                const ledger = [];

                appointments.forEach(appt => {
                    const patient = appt.patientId || {};
                    const procedureCost = appt.cost || 1000; 
                    const doctorCut = (procedureCost * (commissionRate / 100));

                    totalRevenueGenerated += procedureCost;
                    if (commissionRate > 0) {
                        totalCommission += doctorCut;
                        ledger.push({
                            date: appt.start,
                            patientName: patient.fullName || appt.title || 'Walk-in',
                            procedure: appt.type,
                            amountCollected: procedureCost,
                            doctorCut: doctorCut
                        });
                    }
                });

                const upcomingAppointments = await Appointment.find({
                    doctorId: staff._id,
                    status: 'Scheduled',
                    start: { $gte: nextMonthStart, $lte: nextMonthEnd }
                });

                const projectedRevenue = upcomingAppointments.reduce((sum, appt) => sum + (appt.cost || 1000), 0);

                return {
                    staffId: staff._id,
                    name: staff.fullName || staff.name,
                    role: staff.role || 'Doctor',
                    compType: compType,
                    baseSalary: baseSalary,
                    totalCommission: totalCommission,
                    revenueGenerated: totalRevenueGenerated,
                    payoutDue: adjustedBaseSalary + totalCommission,
                    attendanceSummary: { unpaidLeaves, halfDays, leaveDeductions, paidLeaves, presents, weeklyOffs },
                    ledger: ledger,
                    metrics: {
                        treatmentsCompleted: appointments.length,
                        upcomingVisits: upcomingAppointments.length,
                        projectedRevenue: projectedRevenue
                    }
                };
            }

            // CATCH-ALL FALLBACK
            else {
                return {
                    staffId: staff._id,
                    name: staff.fullName || staff.name,
                    role: staff.role || 'Unknown',
                    compType: compType,
                    baseSalary: baseSalary,
                    totalCommission: 0,
                    revenueGenerated: 0,
                    payoutDue: adjustedBaseSalary,
                    attendanceSummary: { unpaidLeaves, halfDays, leaveDeductions, paidLeaves, presents, weeklyOffs },
                    metrics: null
                };
            }
        }));

        const cleanPayrollData = payrollData.filter(Boolean);
        const totalPayrollDue = cleanPayrollData.reduce((sum, s) => sum + s.payoutDue, 0);

        const payments = await Payment.find({ clinicId, branchId, createdAt: { $gte: start, $lte: end } });
        const grossRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

        const expenses = await Expense.find({ clinicId, branchId, date: { $gte: start, $lte: end }, category: { $ne: 'Salaries' } });
        const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        const netProfit = grossRevenue - operatingExpenses - totalPayrollDue;

        res.json({
            period: { month, year, label: `${start.toLocaleString('default', { month: 'long' })} ${year}` },
            metrics: { grossRevenue, operatingExpenses, totalPayrollDue, netProfit },
            payroll: cleanPayrollData
        });

    } catch (error) {
        console.error("Payroll Error:", error);
        res.status(500).json({ message: 'Failed to generate payroll' });
    }
};

module.exports = { getPayrollReport };