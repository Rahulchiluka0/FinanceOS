import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { categoriesService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  parentId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['income', 'expense']).optional(),
  parentId: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  archived: z.boolean().optional(),
})

export const categoriesController = {
  async list(req, res) {
    const data = await categoriesService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await categoriesService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await categoriesService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async archive(req, res) {
    const data = await categoriesService.toggleArchive(req.user.id, req.params.id)
    return ok(res, data)
  },
}
