// Contract section 6: every response, errors too, uses this envelope.

const STATUS_BY_CODE = {
  ERR_VALIDATION: 400,
  ERR_NOT_FOUND: 404,
  ERR_STT_FAILED: 422,
  ERR_RATE_LIMIT: 429,
  ERR_INTERNAL: 500,
};

class AppError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = STATUS_BY_CODE[code] ? code : 'ERR_INTERNAL';
    this.status = status || STATUS_BY_CODE[this.code];
  }
}

const envelope = (data, error) => ({
  success: !error,
  data: error ? null : data,
  error: error || null,
  timestamp: new Date().toISOString(),
});

function sendSuccess(res, data, status = 200) {
  return res.status(status).json(envelope(data, null));
}

function sendError(res, code, message, status) {
  const err = new AppError(code, message, status);
  return res.status(err.status).json(envelope(null, { code: err.code, message: err.message }));
}

module.exports = { AppError, STATUS_BY_CODE, envelope, sendSuccess, sendError };
