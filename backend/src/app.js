const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const { successResponse } = require('./utils/responseHandler');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const firmRoutes = require('./routes/firmRoutes');
const clientRoutes = require('./routes/clientRoutes');
const caseRoutes = require('./routes/caseRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// --- Global middleware -----------------------------------------------------
app.use(
  cors({
    origin: env.frontendUrl,
  })
);
app.use(express.json());

// Lightweight request logger (development convenience).
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Base routes -----------------------------------------------------------
app.get('/', (req, res) => {
  res.send('Profirmo API is running');
});

app.get('/api/health', (req, res) => {
  return successResponse(res, 200, 'Backend API is running successfully', {
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    uptime: process.uptime(),
  });
});

// --- Feature routers -------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/firms', firmRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// --- Error handling --------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
