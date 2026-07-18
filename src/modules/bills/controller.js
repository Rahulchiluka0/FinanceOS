import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { billsService } from './service.js'

const createSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  accountId: z.string().optional().nullable(),
  status: z.enum(['paid', 'unpaid']).optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().optional(),
  accountId: z.string().nullable().optional(),
  status: z.enum(['paid', 'unpaid']).optional(),
})

export const billsController = {
  async list(req, res) {
    const data = await billsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await billsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await billsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async pay(req, res) {
    const data = await billsService.pay(req.user.id, req.params.id)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await billsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
