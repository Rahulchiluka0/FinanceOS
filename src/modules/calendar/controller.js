import { ok } from '../../utils/response.js'
import { calendarService } from './service.js'

export const calendarController = {
  async getMonth(req, res) {
    const data = await calendarService.getMonth(req.user.id, req.query)
    return ok(res, data)
  },
}
