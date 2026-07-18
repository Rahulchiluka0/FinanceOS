import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { usersService } from './service.js'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  theme: z.string().optional(),
  notificationPrefs: z.record(z.string(), z.any()).optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const usersController = {
  async getMe(req, res) {
    const data = await usersService.getMe(req.user.id)
    return ok(res, data)
  },

  async updateMe(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await usersService.updateMe(req.user.id, body)
    return ok(res, data)
  },

  async changePassword(req, res) {
    const body = passwordSchema.parse(req.body)
    const data = await usersService.changePassword(req.user.id, body)
    return ok(res, data)
  },
}
