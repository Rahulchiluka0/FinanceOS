import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { fxService } from './service.js'

const convertSchema = z.object({
  amount: z.number(),
  from: z.string().min(3).max(3),
  to: z.string().min(3).max(3),
})

export const fxController = {
  async rates(_req, res) {
    const data = fxService.getRates()
    return ok(res, data)
  },

  async convert(req, res) {
    const body = convertSchema.parse(req.body)
    const data = fxService.convert(body)
    return ok(res, data)
  },
}
