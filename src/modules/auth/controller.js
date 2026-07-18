import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { authService } from './service.js'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
})

export const authController = {
  async register(req, res) {
    const body = registerSchema.parse(req.body)
    const data = await authService.register(body)
    return ok(res, data, null, 201)
  },

  async login(req, res) {
    const body = loginSchema.parse(req.body)
    const data = await authService.login(body)
    return ok(res, data)
  },

  logout(_req, res) {
    return ok(res, { message: 'Logged out' })
  },

  async forgotPassword(req, res) {
    const email = z.string().email().parse(req.body.email)
    const data = await authService.forgotPassword(email)
    return ok(res, data)
  },

  async resetPassword(req, res) {
    const body = resetSchema.parse(req.body)
    const data = await authService.resetPassword(body)
    return ok(res, data)
  },
}
