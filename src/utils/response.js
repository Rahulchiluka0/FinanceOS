export class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR', details = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function ok(res, data = null, meta = null, status = 200) {
  return res.status(status).json({ success: true, data, meta, error: null })
}

export function fail(res, error, status = 400) {
  const code = error.code || 'ERROR'
  const message = error.message || 'Request failed'
  const details = error.details || null
  return res.status(status).json({
    success: false,
    data: null,
    meta: null,
    error: { code, message, details },
  })
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
