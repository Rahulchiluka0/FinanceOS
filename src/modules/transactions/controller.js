import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { transactionsService } from './service.js'

const createSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive(),
  accountId: z.string().min(1),
  toAccountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  date: z.string().optional(),
  notes: z.string().optional(),
  favorite: z.boolean().optional(),
  receiptUrl: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().positive().optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
  favorite: z.boolean().optional(),
  receiptUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const bulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1) })

export const transactionsController = {
  async list(req, res) {
    const { items, meta } = await transactionsService.list(req.user.id, req.query)
    return ok(res, items, meta)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await transactionsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await transactionsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await transactionsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },

  async bulkRemove(req, res) {
    const { ids } = bulkDeleteSchema.parse(req.body)
    const data = await transactionsService.bulkRemove(req.user.id, ids)
    return ok(res, data)
  },

  async duplicate(req, res) {
    const data = await transactionsService.duplicate(req.user.id, req.params.id)
    return ok(res, data, null, 201)
  },

  async toggleFavorite(req, res) {
    const data = await transactionsService.toggleFavorite(req.user.id, req.params.id)
    return ok(res, data)
  },
}
