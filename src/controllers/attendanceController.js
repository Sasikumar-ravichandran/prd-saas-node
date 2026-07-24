const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Get attendance for a specific date (to populate the frontend roster)
const getDailyAttendance = async (req, res) => {
	try {
		const { date } = req.query; // e.g., '2026-06-25'
		const clinicId = req.user.clinicId;
		const branchId = req.branchId;

		// Get all staff for this branch
		const staff = await User.find({ clinicId, allowedBranches: branchId, status: 'Active' })
			.select('name fullName role');

		// Get attendance records for this specific date
		const records = await Attendance.find({ clinicId, branchId, date });

		// Merge them so the frontend always has the full staff list, even if attendance isn't marked yet
		const roster = staff.map(emp => {
			const existingRecord = records.find(r => r.userId.toString() === emp._id.toString());
			return {
				userId: emp._id,
				name: emp.fullName || emp.name,
				role: emp.role,
				status: existingRecord ? existingRecord.status : 'Present', // Default to Present
				notes: existingRecord ? existingRecord.notes : ''
			};
		});

		res.json(roster);
	} catch (error) {
		console.error("GET ATTENDANCE ERROR:", error);
		res.status(500).json({ message: 'Failed to fetch attendance roster' });
	}
};

// Bulk save attendance for the whole day
const saveBulkAttendance = async (req, res) => {
	try {
		const { date, attendanceData } = req.body; // attendanceData is an array of { userId, status, notes }
		const clinicId = req.user.clinicId;
		const branchId = req.branchId;

		if (!date || !attendanceData || !Array.isArray(attendanceData)) {
			return res.status(400).json({ message: 'Invalid data format' });
		}

		// Use MongoDB bulkWrite for high-performance SaaS saving
		const bulkOps = attendanceData.map(record => ({
			updateOne: {
				filter: { clinicId, date, userId: record.userId },
				update: {
					$set: {
						branchId,
						status: record.status,
						notes: record.notes,
						markedBy: req.user._id
					}
				},
				upsert: true // Creates it if it doesn't exist!
			}
		}));

		await Attendance.bulkWrite(bulkOps);

		res.json({ message: 'Attendance saved successfully' });
	} catch (error) {
		console.error("SAVE ATTENDANCE ERROR:", error);
		res.status(500).json({ message: 'Failed to save attendance' });
	}
};

const getMonthlyAttendance = async (req, res) => {
	try {
		const { month, year } = req.query;
		const clinicId = req.user.clinicId;
		const branchId = req.branchId || req.user.defaultBranch; // Fallback just in case

		// Format the prefix for regex searching (e.g., "2026-06")
		const padMonth = month.toString().padStart(2, '0');
		const datePrefix = `${year}-${padMonth}`;

		// Find all records that start with this month's prefix
		const records = await Attendance.find({
			clinicId,
			date: { $regex: `^${datePrefix}` }
		});

		res.json(records);
	} catch (error) {
		console.error("GET MONTHLY ATTENDANCE ERROR:", error);
		res.status(500).json({ message: 'Failed to fetch monthly records' });
	}
};

const saveMonthlyBulk = async (req, res) => {
    try {
        const { month, year, records } = req.body; 
        const clinicId = req.user.clinicId;
        const branchId = req.branchId || req.user.defaultBranch;

        if (!records || !Array.isArray(records) || !month || !year) {
            return res.status(400).json({ message: 'Month, year, and records array are required' });
        }

        const padMonth = month.toString().padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const startDate = `${year}-${padMonth}-01`;
        const endDate = `${year}-${padMonth}-${lastDay}`;

        // 1. Wipe everything for this clinic, for this month
        const deleteResult = await Attendance.deleteMany({
            clinicId: clinicId,
            date: { $gte: startDate, $lte: endDate }
        });
        
        // ⚡️ Check your backend terminal when you click save! It will tell you how many ghost records it killed.
        console.log(`Deleted ${deleteResult.deletedCount} old records for ${year}-${padMonth}`);

        // 2. If the user cleared the board (empty array), stop here and return success
        if (records.length === 0) {
            return res.json({ message: 'Monthly roster cleared successfully' });
        }

        // 3. Otherwise, save the new records
        const bulkOps = records.map(record => ({
            updateOne: {
                filter: { clinicId, userId: record.userId, date: record.date },
                update: {
                    $set: {
                        branchId,
                        status: record.status,
                        markedBy: req.user._id
                    }
                },
                upsert: true
            }
        }));

        await Attendance.bulkWrite(bulkOps);

        res.json({ message: 'Monthly roster saved successfully' });
    } catch (error) {
        console.error("SAVE MONTHLY BULK ERROR:", error);
        res.status(500).json({ message: 'Failed to save monthly roster' });
    }
};

module.exports = {
	getDailyAttendance,
	saveBulkAttendance,
	getMonthlyAttendance,
	saveMonthlyBulk
}

