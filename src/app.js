const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { runRetentionEngine } = require('./controllers/recallController');

// 1. IMPORT SECURITY PACKAGES
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();

// ==========================================
// SECURITY MIDDLEWARE STACK
// ==========================================

// 1. Helmet: Secures HTTP headers. 
// crossOriginResourcePolicy is false so React can still load images from /uploads
app.use(helmet({
  crossOriginResourcePolicy: false, 
}));

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5713", "https://klinichub.com"],
  credentials: true
}));
// 2. Body Parser with Size Limits (Prevents payload-based DDoS)
app.use(express.json({ limit: '2mb' })); 
app.use(cookieParser());

const csrfProtection = (req, res, next) => {
  // Skip CSRF check for public auth routes (login, register, otp)
  if (req.method === 'GET' || req.path.startsWith('/auth/')) {
    return next();
  }
  
  const requestedWith = req.headers['x-requested-with'];
  if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Forbidden: Invalid request origin' });
  }
  
  next();
};


// 3. Mongo Sanitize: Scans req.body and removes malicious '$' operators
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// 4. Global Rate Limiter: Protects from basic DDoS attacks.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // Limit each IP to 1500 requests per 15 minutes
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use('/api', globalLimiter);
app.use('/api', csrfProtection);
// 5. Strict Auth Limiter: Stops Brute-Force Password / OTP guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 auth attempts per 15 mins
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
// Apply strict limiter ONLY to the sensitive authentication routes

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-otp', authLimiter); 

// ==========================================
// ROUTE DEFINITIONS
// ==========================================

app.get('/', (req, res) => {
  res.send('API is running securely...');
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/procedures', require('./routes/procedureRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/clinical-notes', require('./routes/clinicalNoteRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/settings/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/attendance', require('./routes/attendaceRoutes'));
app.use('/api/financials', require('./routes/financialRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/super-admin', require('./routes/superAdminRoutes'));

// Serve static legacy files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ==========================================
// BACKGROUND JOBS
// ==========================================

cron.schedule('30 9 * * *', () => {
  console.log('[Cron] Triggering daily retention engine...');
  runRetentionEngine();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

module.exports = app;