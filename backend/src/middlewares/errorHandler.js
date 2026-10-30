const multer = require('multer');
const { AppError, sendError } = require('../utils/response');
const { config } = require('../config');

function notFound(req, res) {
  sendError(res, 'ERR_NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
}

// Express 5 forwards rejected promises from async handlers here.
// Never leak a stack trace to the client.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.status);
  }
  if (err instanceof multer.MulterError) {
    return sendError(res, 'ERR_VALIDATION', `Upload error: ${err.message}`);
  }
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'ERR_VALIDATION', 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 'ERR_VALIDATION', 'Request body is too large');
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  const message = config.isProduction ? 'Internal server error' : err.message || 'Internal server error';
  return sendError(res, 'ERR_INTERNAL', message);
}

module.exports = { notFound, errorHandler };
