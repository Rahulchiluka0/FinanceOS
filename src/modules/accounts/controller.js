import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { accountsService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  openingBalance: z.number().optional(),
  balance: z.number().optional(),
  color: z.string().optional(),
  currency: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  openingBalance: z.number().optional(),
  balance: z.number().optional(),
  color: z.string().optional(),
  archived: z.boolean().optional(),
})

const transferSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  notes: z.string().optional(),
})

export const accountsController = {
  async list(req, res) {
    const data = await accountsService.list(req.user.id, req.query)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await accountsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await accountsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async archive(req, res) {
    const data = await accountsService.toggleArchive(req.user.id, req.params.id)
    return ok(res, data)
  },

  async transfer(req, res) {
    const body = transferSchema.parse(req.body)
    const data = await accountsService.transfer(req.user.id, body)
    return ok(res, data)
  },
}
