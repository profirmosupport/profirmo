require('dotenv').config();

// Centralized environment configuration for the Profirmo backend.
// All other modules should import config values from here rather than
// reading process.env directly.
module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret',
  jwtExpiresIn: '7d',
};
