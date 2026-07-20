import { startOfMonth, endOfMonth, mapTransaction } from '../../utils/mappers.js'
import { dashboardRepository } from './repository.js'
import { getOrBuildTwin } from '../ai/twin/builder.js'

export const dashboardService = {
  async getSummary(userId) {
    const from = startOfMonth()
    const to = endOfMonth()

    const [
      accounts,
      incomeAgg,
      expenseAgg,
      recent,
      budgets,
      goals,
      bills,
      recurring,
      investments,
      loans,
      notifications,
    ] = await dashboardRepository.fetchSummaryData(userId, from, to)

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
    const monthlyIncome = incomeAgg._sum.amount || 0
    const monthlyExpenses = expenseAgg._sum.amount || 0
    const netSavings = monthlyIncome - monthlyExpenses
    const investmentsValue = investments.reduce((s, i) => s + i.currentValue, 0)
    const loansRemaining = loans.reduce((s, l) => s + l.remaining, 0)
    const netWorth = totalBalance + investmentsValue - loansRemaining
    const savingRate = monthlyIncome > 0 ? Math.round((netSavings / monthlyIncome) * 100) : 0

    // Health score v2 from Financial Twin (backward compatible field name)
    let healthScore = Math.max(0, Math.min(100, 50 + savingRate))
    try {
      const { profile } = await getOrBuildTwin(userId)
      if (profile?.health?.overall != null) healthScore = profile.health.overall
    } catch (err) {
      console.error('[dashboard-health]', err.message)
    }

    const budgetProgress = await Promise.all(
      budgets.map(async (b) => {
        const spentAgg = await dashboardRepository.spentForBudget(userId, b.categoryId, from, to)
        return {
          id: b.id,
          category: b.category.name,
          limit: b.limitAmount,
          spent: spentAgg._sum.amount || 0,
          period: b.period,
        }
      }),
    )

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      netSavings,
      netWorth,
      healthScore,
      savingRate,
      recentTransactions: recent.map(mapTransaction),
      budgets: budgetProgress,
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.deadline?.toISOString().slice(0, 10) || null,
        color: g.color,
        completed: g.completed,
      })),
      upcomingBills: bills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: b.amount,
        due: b.dueDate.toISOString().slice(0, 10),
      })),
      upcomingRecurring: recurring.map((r) => ({
        id: r.id,
        title: r.title,
        amount: r.amount,
        frequency: r.frequency,
        nextDate: r.nextDate.toISOString().slice(0, 10),
        type: r.type,
      })),
      unreadNotifications: notifications.length,
    }
  },
}
