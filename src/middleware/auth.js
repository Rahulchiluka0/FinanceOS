import jwt from 'jsonwebtoken'
import { env } from '../config/index.js'
import { AppError } from '../utils/response.js'

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'))
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    req.user = { id: decoded.sub, email: decoded.email }
    return next()
  } catch {
    return next(new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'))
  }
}
