import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { loansService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  principal: z.number().positive(),
  remaining: z.number().min(0).optional(),
  interestRate: z.number().min(0),
  emi: z.number().positive(),
  nextDue: z.string().optional().nullable(),
  tenureMonths: z.number().int().positive(),
  paidMonths: z.number().int().min(0).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  principal: z.number().positive().optional(),
  remaining: z.number().min(0).optional(),
  interestRate: z.number().min(0).optional(),
  emi: z.number().positive().optional(),
  nextDue: z.string().nullable().optional(),
  tenureMonths: z.number().int().positive().optional(),
  paidMonths: z.number().int().min(0).optional(),
})

export const loansController = {
  async list(req, res) {
    const data = await loansService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await loansService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await loansService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await loansService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },

  async schedule(req, res) {
    const data = await loansService.schedule(req.user.id, req.params.id)
    return ok(res, data)
  },
}
