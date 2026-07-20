import { z } from 'zod'
import { ok } from '../../utils/response.js'
import { aiService } from './service.js'

const chatSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().optional().nullable(),
  client: z.enum(['web', 'mobile']).optional(),
})

export const aiController = {
  async suggestions(req, res) {
    const data = await aiService.getSuggestions(req.user.id)
    return ok(res, data)
  },

  async chat(req, res) {
    const body = chatSchema.parse(req.body)
    const data = await aiService.chat(req.user.id, body)
    return ok(res, data)
  },

  async chatThreads(req, res) {
    const data = await aiService.listChatThreads(req.user.id)
    return ok(res, data)
  },

  async chatThread(req, res) {
    const data = await aiService.getChatThread(req.user.id, req.params.id)
    return ok(res, data)
  },

  async profile(req, res) {
    const data = await aiService.getProfile(req.user.id)
    return ok(res, data)
  },

  async refreshProfile(req, res) {
    const data = await aiService.refreshProfile(req.user.id)
    return ok(res, data)
  },

  async dashboard(req, res) {
    const data = await aiService.getDashboard(req.user.id)
    return ok(res, data)
  },

  async healthScore(req, res) {
    const data = await aiService.getHealthScore(req.user.id)
    return ok(res, data)
  },

  async patterns(req, res) {
    const data = await aiService.getPatterns(req.user.id, req.query.period)
    return ok(res, data)
  },

  async refreshPatterns(req, res) {
    const data = await aiService.refreshPatterns(req.user.id)
    return ok(res, data)
  },

  async insights(req, res) {
    const data = await aiService.getInsights(req.user.id, {
      status: req.query.status,
      type: req.query.type,
      limit: req.query.limit,
    })
    return ok(res, data)
  },

  async refreshCoach(req, res) {
    const data = await aiService.refreshCoach(req.user.id)
    return ok(res, data)
  },

  async dismissInsight(req, res) {
    const data = await aiService.dismissInsight(req.user.id, req.params.id)
    return ok(res, data)
  },

  async actInsight(req, res) {
    const data = await aiService.actInsight(req.user.id, req.params.id)
    return ok(res, data)
  },

  async smartInsights(req, res) {
    const data = await aiService.getSmartInsights(req.user.id)
    return ok(res, data)
  },
}
