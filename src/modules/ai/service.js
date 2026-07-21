import { AppError } from '../../utils/response.js'
import { aiRepository } from './repository.js'
import { getOrBuildTwin, getHealthHistory } from './twin/builder.js'
import { detectAndStorePatterns, listPatterns } from './patterns/detectors.js'
import {
  evaluateCoach,
  listInsights,
  dismissInsight,
  actInsight,
} from './coach/evaluate.js'
import { askMyMoney, listThreads, getThread } from './chat/orchestrate.js'
import {
  listGoalRecommendations,
  acceptGoalRecommendation,
  dismissGoalRecommendation,
  buildGoalRecommendations,
} from './goals/recommendations.js'
import { runSimulation, listSimulations, listTemplates } from './simulator/engine.js'
import { getMoneyReplay } from './replay/builder.js'

const refreshCooldownMs = 30_000
const lastRefreshByUser = new Map()

export const aiService = {
  async getSuggestions(userId) {
    const insights = await aiRepository.listActiveInsights(userId, 5)
    if (insights.length) {
      return insights.map((i) => ({
        id: i.id,
        title: i.title,
        body: i.body,
        type: i.type,
        severity: i.severity,
        action: i.action,
      }))
    }
    return aiRepository.getSuggestions()
  },

  async chat(userId, { message, threadId, client } = {}) {
    try {
      return await askMyMoney(userId, { message, threadId, client })
    } catch (err) {
      if (err.status) throw new AppError(err.message, err.status, err.code || 'APP_ERROR')
      throw err
    }
  },

  async listChatThreads(userId) {
    return listThreads(userId)
  },

  async getChatThread(userId, threadId) {
    const thread = await getThread(userId, threadId)
    if (!thread) throw new AppError('Thread not found', 404)
    return thread
  },

  async getProfile(userId, { force = false } = {}) {
    const { profile, stale, builtAt, fromCache } = await getOrBuildTwin(userId, { force })
    return {
      profile,
      stale,
      builtAt,
      fromCache,
      asOf: profile.asOf,
    }
  },

  async refreshProfile(userId) {
    const last = lastRefreshByUser.get(userId) || 0
    const now = Date.now()
    if (now - last < refreshCooldownMs) {
      const waitSec = Math.ceil((refreshCooldownMs - (now - last)) / 1000)
      throw new AppError(`Please wait ${waitSec}s before refreshing again`, 429, 'RATE_LIMITED')
    }
    lastRefreshByUser.set(userId, now)
    const profile = await this.getProfile(userId, { force: true })
    await evaluateCoach(userId, { event: 'refresh' }).catch((err) => {
      console.error('[ai-coach]', err.message)
    })
    return profile
  },

  async getHealthScore(userId) {
    const { profile, builtAt, stale } = await getOrBuildTwin(userId)
    const history = await getHealthHistory(userId, 30)
    return {
      overall: profile.health.overall,
      factors: profile.health.factors,
      risk: profile.risk,
      asOf: profile.asOf,
      builtAt,
      stale,
      history,
    }
  },

  async getDashboard(userId) {
    const { profile, builtAt, stale, fromCache } = await getOrBuildTwin(userId)
    let insights = await aiRepository.listActiveInsights(userId, 3)
    if (!insights.length) {
      await evaluateCoach(userId, { event: 'dashboard' }).catch(() => {})
      insights = await aiRepository.listActiveInsights(userId, 3)
    }
    return {
      asOf: profile.asOf,
      builtAt,
      stale,
      fromCache,
      summary: {
        totalBalance: profile.cash.totalBalance,
        liquidBalance: profile.cash.liquidBalance,
        monthlyIncome: profile.cash.monthlyIncome,
        monthlyExpense: profile.cash.monthlyExpense,
        netCashflow: profile.cash.netCashflow,
        savingsRate: profile.cash.savingsRate,
        netWorth: profile.wealth.netWorth,
        runwayMonths: profile.buffers.runwayMonths,
        healthScore: profile.health.overall,
        riskLevel: profile.risk.level,
      },
      health: {
        overall: profile.health.overall,
        factors: profile.health.factors,
      },
      twin: {
        cash: profile.cash,
        wealth: profile.wealth,
        debt: profile.debt,
        buffers: profile.buffers,
        budgets: {
          onTrack: profile.budgets.onTrack,
          atRisk: profile.budgets.atRisk,
          over: profile.budgets.over,
        },
        goals: profile.goals,
        obligations: profile.obligations,
        behavior: {
          topCategories: profile.behavior.topCategories,
          weekendSpendLift: profile.behavior.weekendSpendLift,
          postPaydayLift: profile.behavior.postPaydayLift,
        },
        risk: profile.risk,
        meta: profile.meta,
      },
      insights,
    }
  },

  async getPatterns(userId, period) {
    return listPatterns(userId, period)
  },

  async refreshPatterns(userId) {
    return detectAndStorePatterns(userId)
  },

  async getInsights(userId, query = {}) {
    return listInsights(userId, query)
  },

  async refreshCoach(userId) {
    return evaluateCoach(userId, { event: 'manual' })
  },

  async dismissInsight(userId, id) {
    const row = await dismissInsight(userId, id)
    if (!row) throw new AppError('Insight not found', 404)
    return row
  },

  async actInsight(userId, id) {
    const row = await actInsight(userId, id)
    if (!row) throw new AppError('Insight not found', 404)
    return row
  },

  /** SYSTEM_DESIGN compat alias */
  async getSmartInsights(userId) {
    const insights = await listInsights(userId, { status: 'active', limit: 20 })
    if (!insights.length) {
      await evaluateCoach(userId, { event: 'smart' }).catch(() => {})
    }
    const fresh = insights.length
      ? insights
      : await listInsights(userId, { status: 'active', limit: 20 })
    const patterns = await listPatterns(userId)
    return { insights: fresh, patterns: patterns.patterns, period: patterns.period }
  },

  async getGoalRecommendations(userId, { refresh = false } = {}) {
    return listGoalRecommendations(userId, { refresh })
  },

  async refreshGoalRecommendations(userId) {
    return buildGoalRecommendations(userId)
  },

  async acceptGoalRecommendation(userId, id) {
    const data = await acceptGoalRecommendation(userId, id)
    if (!data) throw new AppError('Recommendation not found', 404)
    return data
  },

  async dismissGoalRecommendation(userId, id) {
    const row = await dismissGoalRecommendation(userId, id)
    if (!row) throw new AppError('Recommendation not found', 404)
    return row
  },

  async listSimTemplates() {
    return listTemplates()
  },

  async runSimulation(userId, body) {
    try {
      return await runSimulation(userId, body)
    } catch (err) {
      if (err.status) throw new AppError(err.message, err.status, err.code || 'APP_ERROR')
      throw err
    }
  },

  async listSimulations(userId) {
    return listSimulations(userId)
  },

  async getReplay(userId, query = {}) {
    return getMoneyReplay(userId, {
      period: query.period,
      from: query.from,
      to: query.to,
      force: query.force === '1' || query.force === 'true',
    })
  },
}
