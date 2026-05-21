// Standardized response helpers so every endpoint returns a consistent
// JSON envelope. Controllers should always go through these helpers.

/**
 * Send a success response.
 * @param {object} res - Express response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - human-readable message
 * @param {*} data - payload (defaults to empty object)
 */
const successResponse = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a paginated success response.
 * @param {object} res - Express response
 * @param {string} message - human-readable message
 * @param {Array} items - list of records for the current page
 * @param {object} pagination - { page, limit, total }
 */
const paginatedResponse = (res, message, items, { page, limit, total }) => {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
  const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;
  return res.status(200).json({
    success: true,
    message,
    data: items,
    meta: {
      page: Number(page) || 1,
      limit: safeLimit,
      total,
      totalPages,
    },
  });
};

/**
 * Send an error response.
 * @param {object} res - Express response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - human-readable message
 * @param {object|null} errors - optional field-level errors
 */
const errorResponse = (res, statusCode, message, errors) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: errors || null,
  });
};

module.exports = { successResponse, paginatedResponse, errorResponse };
