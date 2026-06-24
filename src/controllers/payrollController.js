const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');

const getPayrollReport = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const branchId = req.branchId;

        // Default to current month/year if no filter is provided
        const { mode, month, year, startDate, endDate } = req.query;

        let start, end;

        if (mode === 'custom') {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            // Default to Monthly
            const m = parseInt(month) || new Date().getMonth() + 1;
            const y = parseInt(year) || new Date().getFullYear();
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0, 23, 59, 59);
        }

        // --- 1. PAYROLL MATH (Staff & Doctors) ---
        const staffMembers = await User.find({ clinicId, allowedBranches: branchId });

        const payrollData = await Promise.all(staffMembers.map(async (staff) => {
            const baseSalary = staff.baseSalary || 0;
            const commissionRate = staff.commissionRate || 0;

            let compType = 'Unpaid';
            if (baseSalary > 0 && commissionRate > 0) compType = `₹${baseSalary.toLocaleString()} + ${commissionRate}%`;
            else if (baseSalary > 0) compType = `Fixed (₹${baseSalary.toLocaleString()})`;
            else if (commissionRate > 0) compType = `${commissionRate}% Commission`;

            if (staff.role === 'Receptionist' || staff.role === 'receptionist') {
                return {
                    staffId: staff._id,
                    name: staff.fullName || staff.name,
                    role: 'Receptionist',
                    compType: baseSalary > 0 ? `Fixed (₹${baseSalary.toLocaleString()})` : 'Not Set',
                    baseSalary: baseSalary,
                    totalCommission: 0,
                    revenueGenerated: 0,
                    payoutDue: baseSalary,
                    ledger: []
                };
            }

            if (staff.role === 'Doctor' || staff.role === 'doctor') {
                const appointments = await Appointment.find({
                    doctorId: staff._id,
                    status: 'Completed',
                    // ⚡️ FIXED: Using 'start' and 'end' Date objects
                    start: { $gte: start, $lte: end }
                }).populate('patientId', 'fullName');

                let totalRevenueGenerated = 0;
                let totalCommission = 0;
                const ledger = [];

                if (commissionRate > 0) {
                    appointments.forEach(appt => {
                        const patient = appt.patientId || {};
                        const procedureCost = appt.cost || 1000;
                        const doctorCut = (procedureCost * (commissionRate / 100));

                        totalRevenueGenerated += procedureCost;
                        totalCommission += doctorCut;

                        ledger.push({
                            date: appt.start,
                            patientName: patient.fullName || 'Walk-in',
                            procedure: appt.type || 'Consultation',
                            amountCollected: procedureCost,
                            commissionPercentage: `${commissionRate}%`,
                            doctorCut: doctorCut || 0
                        });
                    });
                } else {
                    appointments.forEach(appt => totalRevenueGenerated += (appt.cost || 1000));
                }

                return {
                    staffId: staff._id,
                    name: staff.fullName || staff.name,
                    role: 'Doctor',
                    compType: compType,
                    baseSalary: baseSalary || 0, 
                    totalCommission: totalCommission || 0,
                    revenueGenerated: totalRevenueGenerated || 0,
                    payoutDue: (baseSalary || 0) + (totalCommission || 0), 
                    ledger: ledger || []
                };
            }
        }));

        const cleanPayrollData = payrollData.filter(Boolean);
        const totalPayrollDue = cleanPayrollData.reduce((sum, s) => sum + s.payoutDue, 0);

        // --- 2. GROSS REVENUE (All patient payments this month) ---
        const payments = await Payment.find({
            // ⚡️ FIXED: Using 'start' and 'end' Date objects
            clinicId, branchId, createdAt: { $gte: start, $lte: end }
        });
        const grossRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

        // --- 3. OPERATING EXPENSES (Exclude 'Salaries') ---
        const expenses = await Expense.find({
            // ⚡️ FIXED: Using 'start' and 'end' Date objects
            clinicId, branchId, date: { $gte: start, $lte: end }, category: { $ne: 'Salaries' }
        });
        const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        // --- 4. THE ULTIMATE SAAS METRIC: NET PROFIT ---
        const netProfit = grossRevenue - operatingExpenses - totalPayrollDue;

        res.json({
            // ⚡️ FIXED: Formatting the 'start' object safely
            period: { month, year, label: `${start.toLocaleString('default', { month: 'long' })} ${year}` },
            metrics: {
                grossRevenue,
                operatingExpenses,
                totalPayrollDue,
                netProfit
            },
            payroll: cleanPayrollData
        });

    } catch (error) {
        console.error("Payroll Error:", error);
        res.status(500).json({ message: 'Failed to generate payroll' });
    }
};

module.exports = { getPayrollReport };