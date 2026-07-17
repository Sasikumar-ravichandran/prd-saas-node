const Expense = require('../models/Expense');
const Payment = require('../models/Payment');

const getMasterLedger = async (req, res) => {
    try {
        const { startDate, endDate, filterType } = req.query;
        const clinicId = req.user.clinicId;

        // 1. Build the Date Query
        let dateQuery = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateQuery = { $gte: start, $lte: end };
        }

        const baseQuery = { clinicId };
        if (Object.keys(dateQuery).length > 0) baseQuery.date = dateQuery;

        // 2. Fetch Data Concurrently for Maximum Speed
        const [expenses, payments] = await Promise.all([
            filterType === 'Payment' ? [] : Expense.find(baseQuery).populate('recordedBy', 'fullName name'),
            filterType === 'Expense' ? [] : Payment.find(baseQuery).populate('patientId', 'fullName name')
        ]);

        let totalIncome = 0;
        let totalExpense = 0;

        // 3. Normalize Expenses
        const formattedExpenses = expenses.map(exp => {
            totalExpense += exp.amount;
            return {
                _id: exp._id,
                type: 'Expense',
                title: exp.vendor || exp.category,
                category: exp.category,
                amount: exp.amount,
                method: exp.paymentMethod || 'Unknown',
                date: exp.date,
                loggedBy: exp.recordedBy?.fullName || exp.recordedBy?.name || 'Admin',
                status: 'PAID'
            };
        });

        // 4. Normalize Payments (Income)
        const formattedPayments = payments.map(pay => {
            totalIncome += pay.amount;
            return {
                _id: pay._id,
                type: 'Payment',
                title: pay.patientId ? (pay.patientId.fullName || pay.patientId.name) : 'Walk-in Patient',
                category: 'Patient Bill',
                amount: pay.amount,
                method: pay.method,
                date: pay.date,
                loggedBy: 'System', // Payments are usually logged against the invoice
                status: 'COMPLETED'
            };
        });

        // 5. Combine and Sort (Newest First)
        const allTransactions = [...formattedExpenses, ...formattedPayments].sort((a, b) => new Date(b.date) - new Date(a.date));

        // 6. Send SaaS-Ready Payload
        res.json({
            metrics: {
                totalIncome,
                totalExpense,
                netProfit: totalIncome - totalExpense
            },
            transactions: allTransactions
        });

    } catch (error) {
        console.error("LEDGER ERROR:", error);
        res.status(500).json({ message: 'Failed to fetch financial ledger' });
    }
};

module.exports = { getMasterLedger };