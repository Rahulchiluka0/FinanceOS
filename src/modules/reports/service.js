import { startOfMonth, endOfMonth } from '../../utils/mappers.js'
import { MONTH_LABELS, reportsRepository } from './repository.js'

function monthRangeForOffset(offset) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return { from: startOfMonth(d), to: endOfMonth(d), label: MONTH_LABELS[d.getMonth()] }
}

export const reportsService = {
  async overview(userId) {
    const from = startOfMonth()
    const to = endOfMonth()

    const [incomeAgg, expenseAgg] = await Promise.all([
      reportsRepository.aggregateIncome(userId, from, to),
      reportsRepository.aggregateExpense(userId, from, to),
    ])

    const income = incomeAgg._sum.amount || 0
    const expense = expenseAgg._sum.amount || 0
    const net = income - expense
    const savingRate = income > 0 ? Math.round((net / income) * 100) : 0

    return { income, expense, net, savingRate }
  },

  async cashflow(userId) {
    const months = []
    for (let i = -5; i <= 0; i++) {
      const { from, to, label } = monthRangeForOffset(i)
      const [incomeAgg, expenseAgg] = await Promise.all([
        reportsRepository.aggregateIncome(userId, from, to),
        reportsRepository.aggregateExpense(userId, from, to),
      ])
      months.push({
        month: label,
        income: incomeAgg._sum.amount || 0,
        expense: expenseAgg._sum.amount || 0,
      })
    }
    return months
  },

  async categories(userId) {
    const from = startOfMonth()
    const to = endOfMonth()

    const grouped = await reportsRepository.expenseByCategory(userId, from, to)
    const categoryIds = grouped.map((g) => g.categoryId).filter(Boolean)
    const categories = await reportsRepository.findCategoriesByIds(categoryIds)
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]))

    return grouped
      .map((g) => ({
        name: byId[g.categoryId]?.name || 'Uncategorized',
        value: g._sum.amount || 0,
        color: byId[g.categoryId]?.color || '#94A3B8',
      }))
      .sort((a, b) => b.value - a.value)
  },
}
