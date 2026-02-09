const express = require('express');
const cors = require('cors');

const app = express();

// --- Middleware ---
app.use(cors()); // Allows React to talk to Node
app.use(express.json()); // Allows Node to understand JSON data sent from React

// --- Routes (We will add these later) ---
// app.use('/api/patients', require('./routes/patientRoutes'));

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/procedures', require('./routes/procedureRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
module.exports = app;