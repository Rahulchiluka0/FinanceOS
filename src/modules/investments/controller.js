import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { investmentsService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  invested: z.number().min(0),
  currentValue: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  invested: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
})

export const investmentsController = {
  async list(req, res) {
    const data = await investmentsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await investmentsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await investmentsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await investmentsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
