const Expense = require('../models/Expense');
const Invoice = require('../models/Invoice');

const getMasterLedger = async (req, res) => {
    try {
        // ⚡️ 1. Extract page and limit from req.query (default to page 1, limit 10)
        const { startDate, endDate, filterType } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const clinicId = req.user.clinicId;

        let expenseDateQuery = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            expenseDateQuery = { date: { $gte: start, $lte: end } };
        }

        // 2. Fetch Data Concurrently
        const [expenses, invoices] = await Promise.all([
            filterType === 'Payment' ? [] : Expense.find({ clinicId, ...expenseDateQuery }).populate('recordedBy', 'fullName name'),
            
            filterType === 'Expense' ? [] : Invoice.find({ 
                clinicId, 
                status: { $in: ['Paid', 'Partial'] } 
            }).populate('patientId', 'fullName name')
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        const formattedPayments = [];

        // 3. Helper function to check if a date falls within the frontend's requested date range
        const isWithinRange = (dateStr) => {
            if (!startDate || !endDate) return true; // No filter, return all
            const d = new Date(dateStr);
            const s = new Date(startDate); s.setHours(0, 0, 0, 0);
            const e = new Date(endDate); e.setHours(23, 59, 59, 999);
            return d >= s && d <= e;
        };

        // 4. INTELLIGENT INVOICE PROCESSING (Handles both Old and New data)
        invoices.forEach(inv => {
            // SCENARIO A: The "New" Format (Like INV-491015)
            if (inv.payments && inv.payments.length > 0) {
                inv.payments.forEach(payment => {
                    if (isWithinRange(payment.date)) {
                        totalIncome += Number(payment.amount) || 0;
                        formattedPayments.push({
                            _id: payment._id || `${inv._id}-${payment.date}`,
                            type: 'Payment',
                            title: inv.patientId ? (inv.patientId.fullName || inv.patientId.name) : 'Walk-in',
                            category: `Invoice: ${inv.invoiceNumber}`,
                            amount: Number(payment.amount) || 0,
                            method: payment.method || 'Unknown',
                            date: payment.date,
                            loggedBy: 'System',
                            status: 'COMPLETED'
                        });
                    }
                });
            } 
            // SCENARIO B: The "Legacy" Format
            else {
                if (isWithinRange(inv.updatedAt)) {
                    const assumedPaid = inv.finalAmount - (inv.balance || 0);
                    
                    if (assumedPaid > 0) {
                        totalIncome += assumedPaid;
                        formattedPayments.push({
                            _id: inv._id,
                            type: 'Payment',
                            title: inv.patientId ? (inv.patientId.fullName || inv.patientId.name) : 'Walk-in',
                            category: `Invoice: ${inv.invoiceNumber}`,
                            amount: assumedPaid,
                            method: 'System',
                            date: inv.updatedAt,
                            loggedBy: 'System',
                            status: 'COMPLETED'
                        });
                    }
                }
            }
        });

        // 5. Normalize Expenses
        const formattedExpenses = expenses.map(exp => {
            totalExpense += Number(exp.amount) || 0;
            return {
                _id: exp._id,
                type: 'Expense',
                title: exp.vendor || exp.category,
                category: exp.category,
                amount: Number(exp.amount) || 0,
                method: exp.paymentMethod || 'Unknown',
                date: exp.date,
                loggedBy: exp.recordedBy?.fullName || exp.recordedBy?.name || 'Admin',
                status: 'PAID'
            };
        });

        // 6. Combine and Sort (Newest First)
        const allTransactions = [...formattedExpenses, ...formattedPayments].sort((a, b) => new Date(b.date) - new Date(a.date));

        // ⚡️ 7. PAGINATION LOGIC 
        const totalCount = allTransactions.length; // Total records matching filters
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        // Slice the array to only return the exact 5/10/15 rows the frontend asked for
        const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

        // 8. Return paginated data and metrics
        res.json({
            metrics: {
                totalIncome,
                totalExpense,
                netProfit: totalIncome - totalExpense
            },
            totalCount, // ⚡️ Send totalCount so frontend pagination knows how many pages exist
            transactions: paginatedTransactions // ⚡️ Send only the sliced data
        });

    } catch (error) {
        console.error("LEDGER ERROR:", error);
        res.status(500).json({ message: 'Failed to fetch financial ledger' });
    }
};

module.exports = { getMasterLedger };