import { ok } from '../../utils/response.js'
import { dataService } from './service.js'

export const dataController = {
  async exportBackup(req, res) {
    const data = await dataService.exportBackup(req.user.id)
    return ok(res, data)
  },

  async exportCsv(req, res) {
    const csv = await dataService.exportCsv(req.user.id)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"')
    return res.status(200).send(csv)
  },

  async importTransactions(req, res) {
    const data = await dataService.importTransactions(req.user.id, req.body)
    return ok(res, data)
  },

  async restore(req, res) {
    const data = await dataService.restoreBackup(req.user.id, req.body)
    return ok(res, data)
  },
}
