import { ok } from '../../utils/response.js'
import { dashboardService } from './service.js'

export const dashboardController = {
  async getSummary(req, res) {
    const data = await dashboardService.getSummary(req.user.id)
    return ok(res, data)
  },
}
