// Wraps an async controller so that any thrown/rejected error is forwarded
// to the central Express error handler via next(). Avoids repetitive
// try/catch blocks in every controller.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
