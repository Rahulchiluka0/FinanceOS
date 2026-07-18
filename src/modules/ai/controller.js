import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { aiService } from './service.js'

const chatSchema = z.object({
  message: z.string().min(1),
})

export const aiController = {
  async suggestions(_req, res) {
    const data = aiService.getSuggestions()
    return ok(res, data)
  },

  async chat(req, res) {
    const { message } = chatSchema.parse(req.body)
    const data = aiService.chat(message)
    return ok(res, data)
  },
}
