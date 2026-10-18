import multer from 'multer';
import env from '../../config/env.js';
import { ApiError } from '../utils/apiResponse.js';

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || err.errors;

  if (err instanceof multer.MulterError) { status = 400; message = err.message; }
  // Postgres error codes
  if (err.code === '23505') { status = 409; message = 'Duplicate record'; details = err.detail; }
  if (err.code === '23503') { status = 409; message = 'Referenced record does not exist or is in use'; details = err.detail; }
  if (err.code === '23514') { status = 400; message = 'Value violates a database constraint'; details = err.constraint; }
  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') { status = 401; message = 'Invalid or expired token'; }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? 'Internal server error' : message,
    ...(details ? { details } : {}),
    ...(!env.isProd && status >= 500 ? { stack: err.stack } : {}),
  });
};
