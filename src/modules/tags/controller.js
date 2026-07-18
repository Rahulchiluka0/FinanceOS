import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { tagsService } from './service.js'

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})

export const tagsController = {
  async list(req, res) {
    const data = await tagsService.list(req.user.id)
    return ok(res, data)
  },

  async create(req, res) {
    const body = createSchema.parse(req.body)
    const data = await tagsService.create(req.user.id, body)
    return ok(res, data, null, 201)
  },

  async update(req, res) {
    const body = updateSchema.parse(req.body)
    const data = await tagsService.update(req.user.id, req.params.id, body)
    return ok(res, data)
  },

  async remove(req, res) {
    const data = await tagsService.remove(req.user.id, req.params.id)
    return ok(res, data)
  },
}
