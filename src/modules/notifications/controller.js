import { ok } from '../../utils/response.js'
import { notificationsService } from './service.js'

export const notificationsController = {
  async list(req, res) {
    const data = await notificationsService.list(req.user.id, req.query)
    return ok(res, data)
  },

  async markRead(req, res) {
    const data = await notificationsService.markRead(req.user.id, req.params.id)
    return ok(res, data)
  },

  async markAllRead(req, res) {
    const data = await notificationsService.markAllRead(req.user.id)
    return ok(res, data)
  },
}
