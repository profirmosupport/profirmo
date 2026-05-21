const { validate } = require('../utils/validators');
const { errorResponse } = require('../utils/responseHandler');

/**
 * Build a middleware that validates req.body against the given rules.
 * On failure responds with 422 and a field-level errors map.
 * @param {object} rulesObject - { fieldName: 'required|email|min:6' }
 * @returns {function} Express middleware
 */
const validateBody = (rulesObject) => {
  return (req, res, next) => {
    const { valid, errors } = validate(req.body || {}, rulesObject);
    if (!valid) {
      return errorResponse(res, 422, 'Validation failed', errors);
    }
    return next();
  };
};

module.exports = { validateBody };
