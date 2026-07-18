import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { subscriptionsService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  cycle: z.enum(['monthly', 'yearly', 'Monthly', 'Yearly']),
  nextRenewal: z.string().min(1),
  status: z.enum(['active', 'paused']).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  cycle: z.enum(['monthly', 'yearly', 'Monthly', 'Yearly']).optional(),
  nextRenewal: z.string().optional(),
  status: z.enum(['active', 'paused']).optional(),
})

export const subscriptionsController = {
  async list(req, res) {
    const data = await subscriptionsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await subscriptionsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await subscriptionsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async pause(req, res) {
    const data = await subscriptionsService.pause(req.user.id, req.params.id)
    return ok(res, data)
  },

  async resume(req, res) {
    const data = await subscriptionsService.resume(req.user.id, req.params.id)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await subscriptionsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
