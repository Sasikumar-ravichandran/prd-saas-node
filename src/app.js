const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const cron = require('node-cron');
const { runRetentionEngine } = require('./controllers/recallController');

// --- Middleware ---
app.use(cors()); // Allows React to talk to Node
app.use(express.json()); // Allows Node to understand JSON data sent from React

// --- Routes (We will add these later) ---
// app.use('/api/patients', require('./routes/patientRoutes'));

app.get('/', (req, res) => {
  res.send('API is running...');
});
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/procedures', require('./routes/procedureRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/clinical-notes', require('./routes/clinicalNoteRoutes'));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/settings/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/attendance', require('./routes/attendaceRoutes'));
app.use('/api/financials', require('./routes/financialRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/super-admin', require('./routes/superAdminRoutes'));

cron.schedule('30 9 * * *', () => {
  console.log('[Cron] Triggering daily retention engine...');
  runRetentionEngine();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});


module.exports = app;