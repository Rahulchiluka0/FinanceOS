import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { recurringService } from './service.js'

const createSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']).default('monthly'),
  nextDate: z.string(),
  accountId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']).optional(),
  nextDate: z.string().optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'ended']).optional(),
})

export const recurringController = {
  async list(req, res) {
    const data = await recurringService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await recurringService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await recurringService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async pause(req, res) {
    const data = await recurringService.setStatus(req.user.id, req.params.id, 'paused')
    return ok(res, data)
  },

  async resume(req, res) {
    const data = await recurringService.setStatus(req.user.id, req.params.id, 'active')
    return ok(res, data)
  },

  async end(req, res) {
    const data = await recurringService.setStatus(req.user.id, req.params.id, 'ended')
    return ok(res, data)
  },

  async skip(req, res) {
    const data = await recurringService.skip(req.user.id, req.params.id)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await recurringService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
