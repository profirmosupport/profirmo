const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Thin wrapper around jsonwebtoken so token configuration lives in one place.

/**
 * Sign a JWT with the configured secret and expiry.
 * @param {object} payload - claims to embed (e.g. { id, role })
 * @returns {string} signed token
 */
const signToken = (payload) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
};

/**
 * Verify a JWT. Returns the decoded payload or throws on failure.
 * @param {string} token - raw JWT string
 * @returns {object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};

module.exports = { signToken, verifyToken };
