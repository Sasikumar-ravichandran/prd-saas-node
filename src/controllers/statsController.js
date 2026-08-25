// backend/controllers/statsController.js
const Invoice = require('../models/Invoice');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getMyStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        // 1. Handle Month Selection
        const targetDate = req.query.month ? new Date(`${req.query.month}-01`) : new Date();
        const firstDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

        const startStr = firstDay.toISOString().split('T')[0];
        const endStr = lastDay.toISOString().split('T')[0];

        // ⚡️ NEW: Get Pagination Params (Default to page 1, limit 5)
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 5;
        const skip = (page - 1) * limit;

        // 2. Attendance Data
        const attendanceRecords = await Attendance.find({
            userId,
            date: { $gte: startStr, $lte: endStr }
        }).sort({ date: -1 });

        const daysPresent = attendanceRecords.filter(a => a.status === 'Present').length;
        const halfDays = attendanceRecords.filter(a => a.status === 'Half-Day').length;
        const paidLeaves = attendanceRecords.filter(a => a.status === 'Paid Leave').length;
        const fullAbsent = attendanceRecords.filter(a => ['Absent', 'Unpaid Leave'].includes(a.status)).length;
        const lopDays = fullAbsent + (halfDays * 0.5);

        const lopDetails = attendanceRecords
            .filter(a => ['Absent', 'Unpaid Leave', 'Half-Day'].includes(a.status))
            .map(a => ({ date: a.date, status: a.status }));

        const baseSalary = user.salary || 0;
        const dailyRate = baseSalary / 30;
        const lopDeduction = lopDays * dailyRate;

        let payload = {
            role: user.role,
            month: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
            attendance: { daysPresent, halfDays, paidLeaves, lopDays, lopDetails },
            financials: {
                baseSalary,
                lopDeduction,
                netBaseSalary: baseSalary - lopDeduction
            }
        };

        // 3. Doctor-Specific Data (Rich Analytics)
        if (user.role == 'Doctor') {
            const invoiceStats = await Invoice.aggregate([
                {
                    $match: {
                        doctorId: new mongoose.Types.ObjectId(userId),
                        status: { $ne: 'Void' },
                        createdAt: { $gte: firstDay, $lte: new Date(lastDay.setHours(23, 59, 59)) }
                    }
                },
                { $unwind: "$items" },
                {
                    $facet: {
                        // Overall Totals (Not paginated)
                        "totals": [
                            {
                                $group: {
                                    _id: null,
                                    totalTreatments: { $sum: 1 },
                                    totalCommission: { $sum: "$items.doctorCommissionAmount" }
                                }
                            }
                        ],
                        // Breakdown by Procedure (Not paginated)
                        "procedureBreakdown": [
                            {
                                $group: {
                                    _id: "$items.procedureName",
                                    count: { $sum: 1 },
                                    earned: { $sum: "$items.doctorCommissionAmount" }
                                }
                            },
                            { $sort: { earned: -1 } },
                        ],
                        
                        // ⚡️ NEW: Get the total count of items for pagination math
                        "activityCount": [
                            { $count: "total" }
                        ],

                        // ⚡️ UPDATED: Paginated Recent Activity Log
                        "recentActivity": [
                            { $sort: { createdAt: -1 } },
                            
                            // ⚡️ Pagination applied HERE (before the lookup for max performance!)
                            { $skip: skip },
                            { $limit: limit },

                            {
                                $lookup: {
                                    from: 'patients',
                                    localField: 'patientId',
                                    foreignField: '_id',
                                    as: 'patientInfo'
                                }
                            },
                            { $unwind: { path: "$patientInfo", preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    date: "$createdAt",
                                    invoiceNumber: 1,
                                    procedure: "$items.procedureName",
                                    earned: "$items.doctorCommissionAmount",
                                    patientName: "$patientInfo.fullName"
                                }
                            }
                        ]
                    }
                }
            ]);

            const data = invoiceStats[0];
            const commission = data.totals.length > 0 ? data.totals[0].totalCommission : 0;
            const treatments = data.totals.length > 0 ? data.totals[0].totalTreatments : 0;
            
            // ⚡️ Extract the total count from the new facet
            const totalActivityCount = data.activityCount.length > 0 ? data.activityCount[0].total : 0;

            payload.financials.commissionEarned = commission;
            payload.financials.totalEstimatedPayout = payload.financials.netBaseSalary + commission;

            payload.doctorStats = {
                treatmentsDone: treatments,
                topProcedures: data.procedureBreakdown,
                recentActivity: data.recentActivity, // This now only contains 5 items!
                totalActivityCount: totalActivityCount // React needs this for the pagination footer
            };
        } else {
            payload.financials.totalEstimatedPayout = payload.financials.netBaseSalary;
        }

        res.json(payload);
    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ message: "Failed to load stats" });
    }
};