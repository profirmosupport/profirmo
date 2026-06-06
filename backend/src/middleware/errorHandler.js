const { errorResponse } = require('../utils/responseHandler');

// 404 handler — mounted after all routes. Any request that did not match
// a route lands here.
const notFoundHandler = (req, res) => {
  return errorResponse(
    res,
    404,
    `Route not found: ${req.method} ${req.originalUrl}`
  );
};

// Central error handler. Services throw plain objects/Errors that may carry a
// `statusCode` and optional `errors` map; this normalizes them into a response.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  // err.message can be a string OR an object — when upstream services
  // surface a structured error envelope (e.g. partner APIs) we end up
  // with an object here. Coerce to a readable string so logs and the
  // HTTP response body don't collapse to "[object Object]".
  const stringify = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (v.message && typeof v.message === 'string') return v.message;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const message = stringify(err.message) || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl} -`, err);
  } else {
    console.warn(
      `[Warn] ${req.method} ${req.originalUrl} - ${statusCode} ${message}`,
      err.upstreamCode ? `(upstream=${err.upstreamCode})` : ''
    );
  }

  return errorResponse(res, statusCode, message, err.errors || null);
};

module.exports = { notFoundHandler, errorHandler };
