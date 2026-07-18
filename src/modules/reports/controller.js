import { ok } from '../../utils/response.js'
import { reportsService } from './service.js'

export const reportsController = {
  async overview(req, res) {
    const data = await reportsService.overview(req.user.id)
    return ok(res, data)
  },

  async cashflow(req, res) {
    const data = await reportsService.cashflow(req.user.id)
    return ok(res, data)
  },

  async categories(req, res) {
    const data = await reportsService.categories(req.user.id)
    return ok(res, data)
  },
}
