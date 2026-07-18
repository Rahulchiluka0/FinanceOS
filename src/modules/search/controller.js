import { ok } from '../../utils/response.js'
import { searchService } from './service.js'

export const searchController = {
  async search(req, res) {
    const data = await searchService.search(req.user.id, req.query)
    return ok(res, data)
  },
}
