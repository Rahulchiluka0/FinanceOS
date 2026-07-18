import { ZodError } from 'zod'
import { AppError, fail } from '../utils/response.js'

export function notFound(req, res) {
  return fail(res, { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` }, 404)
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err instanceof ZodError) {
    return fail(
      res,
      {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      422,
    )
  }

  if (err instanceof AppError) {
    return fail(res, err, err.status)
  }

  console.error(err)
  return fail(res, { code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
}
