import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { AppError } from '../../utils/response.js'
import { signToken } from '../../middleware/auth.js'
import { publicUser } from '../../utils/mappers.js'
import { env } from '../../config/index.js'
import { userRepository } from './repository.js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const authService = {
  async register({ name, email, password }) {
    const exists = await userRepository.findByEmail(email)
    if (exists) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS')

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await userRepository.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
    })

    const token = signToken({ sub: user.id, email: user.email })
    return { user: publicUser(user), token }
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email)
    if (!user) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS')

    const token = signToken({ sub: user.id, email: user.email })
    return { user: publicUser(user), token }
  },

  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email)
    // Always return a generic message; include resetUrl in local/dev for testing
    if (!user) {
      return {
        message: 'If an account exists, a reset link has been generated.',
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await userRepository.invalidateResetTokens(user.id)
    await userRepository.createResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const resetUrl = `${env.clientOrigin}/reset-password?token=${rawToken}`
    console.log(`[auth] Password reset link for ${user.email}: ${resetUrl}`)

    return {
      message: 'If an account exists, a reset link has been generated.',
      // Exposed for local demo (no email provider wired)
      resetUrl,
      expiresInMinutes: 60,
    }
  },

  async resetPassword({ token, password }) {
    if (!token || !password) throw new AppError('Token and password are required')

    const tokenHash = hashToken(token)
    const row = await userRepository.findResetToken(tokenHash)
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await userRepository.update(row.userId, { passwordHash })
    await userRepository.markResetTokenUsed(row.id)

    return { message: 'Password updated. You can sign in now.' }
  },
}
