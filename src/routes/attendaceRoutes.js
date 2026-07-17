const express = require('express');
const router = express.Router();
const { getDailyAttendance,
	saveBulkAttendance,
	getMonthlyAttendance,
	saveMonthlyBulk } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/monthly')
	.get(getMonthlyAttendance);

router.route('/monthly-bulk')
	.post(saveMonthlyBulk);
	
router.route('/')
	.get(getDailyAttendance)
	.post(saveBulkAttendance);

module.exports = router;