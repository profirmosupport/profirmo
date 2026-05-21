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
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl} -`, err);
  } else {
    console.warn(`[Warn] ${req.method} ${req.originalUrl} - ${message}`);
  }

  return errorResponse(res, statusCode, message, err.errors || null);
};

module.exports = { notFoundHandler, errorHandler };
