import bcrypt from 'bcryptjs'
import { AppError } from '../../utils/response.js'
import { publicUser } from '../../utils/mappers.js'
import { usersRepository } from './repository.js'

export const usersService = {
  async getMe(userId) {
    const user = await usersRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND')
    return publicUser(user)
  },

  async updateMe(userId, body) {
    const data = {}
    if (body.name !== undefined) data.name = body.name
    if (body.currency !== undefined) data.currency = body.currency
    if (body.timezone !== undefined) data.timezone = body.timezone
    if (body.dateFormat !== undefined) data.dateFormat = body.dateFormat
    if (body.theme !== undefined) data.theme = body.theme
    if (body.notificationPrefs !== undefined) {
      data.notificationPrefs = JSON.stringify(body.notificationPrefs)
    }

    const user = await usersRepository.update(userId, data)
    return publicUser(user)
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await usersRepository.findById(userId)
    if (!user) throw new AppError('User not found', 404)

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD')

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await usersRepository.update(userId, { passwordHash })
    return { message: 'Password updated' }
  },
}
