/**
 * Operational error with an HTTP status code attached, so
 * errorHandler.js can distinguish "expected" failures (bad input,
 * not found, forbidden) from genuine bugs.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
