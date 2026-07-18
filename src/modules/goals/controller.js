import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { goalsService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional(),
  deadline: z.string().optional().nullable(),
  color: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  deadline: z.string().nullable().optional(),
  color: z.string().optional(),
})

const amountSchema = z.object({ amount: z.number().positive() })

export const goalsController = {
  async list(req, res) {
    const data = await goalsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await goalsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await goalsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await goalsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },

  async deposit(req, res) {
    const { amount } = amountSchema.parse(req.body)
    const data = await goalsService.deposit(req.user.id, req.params.id, amount)
    return ok(res, data)
  },

  async withdraw(req, res) {
    const { amount } = amountSchema.parse(req.body)
    const data = await goalsService.withdraw(req.user.id, req.params.id, amount)
    return ok(res, data)
  },
}
