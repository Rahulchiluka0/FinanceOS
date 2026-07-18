import { AppError } from '../../utils/response.js'
import { db } from '../../lib/prisma.js'
import { checkBudgetAlerts } from './alerts.js'
import { budgetsRepository } from './repository.js'

async function mapBudget(userId, b, { capitalizePeriod = false } = {}) {
  const agg = await budgetsRepository.spentForCategory(userId, b.categoryId, b.period)
  return {
    id: b.id,
    category: b.category.name,
    categoryId: b.categoryId,
    period: capitalizePeriod
      ? b.period.charAt(0).toUpperCase() + b.period.slice(1)
      : b.period,
    limit: b.limitAmount,
    spent: agg._sum.amount || 0,
    alertAt: b.alertAt,
  }
}

export const budgetsService = {
  async list(userId) {
    const budgets = await budgetsRepository.findManyByUser(userId)
    return Promise.all(budgets.map((b) => mapBudget(userId, b, { capitalizePeriod: true })))
  },

  async create(userId, body) {
    const category = await db().category.findFirst({
      where: { id: body.categoryId, userId },
    })
    if (!category) throw new AppError('Category not found', 404)

    const budget = await budgetsRepository.create({
      userId,
      categoryId: body.categoryId,
      period: body.period,
      limitAmount: body.limitAmount,
      alertAt: body.alertAt ?? 80,
    })
    // Existing spend may already be over the new threshold
    await checkBudgetAlerts(userId, budget.categoryId).catch(() => {})
    return mapBudget(userId, budget)
  },

  async update(userId, id, body) {
    const existing = await budgetsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Budget not found', 404)

    const budget = await budgetsRepository.update(existing.id, {
      categoryId: body.categoryId,
      period: body.period,
      limitAmount: body.limitAmount,
      alertAt: body.alertAt,
    })
    await checkBudgetAlerts(userId, budget.categoryId).catch(() => {})
    return mapBudget(userId, budget)
  },

  async remove(userId, id) {
    const existing = await budgetsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Budget not found', 404)

    await budgetsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
