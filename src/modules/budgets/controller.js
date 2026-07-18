import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { budgetsService } from './service.js'

const createSchema = z.object({
  categoryId: z.string().min(1),
  period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  limitAmount: z.number().positive(),
  alertAt: z.number().int().min(1).max(100).optional(),
})

const updateSchema = z.object({
  categoryId: z.string().optional(),
  period: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  limitAmount: z.number().positive().optional(),
  alertAt: z.number().int().min(1).max(100).optional(),
})

export const budgetsController = {
  async list(req, res) {
    const data = await budgetsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await budgetsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await budgetsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await budgetsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
