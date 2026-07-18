import { db } from '../../lib/prisma.js'
import { startOfMonth, endOfMonth } from '../../utils/mappers.js'

export const dashboardRepository = {
  fetchSummaryData(userId, from, to) {
    return Promise.all([
      db().account.findMany({ where: { userId, archived: false } }),
      db().transaction.aggregate({
        where: { userId, type: 'income', date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      db().transaction.aggregate({
        where: { userId, type: 'expense', date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      db().transaction.findMany({
        where: { userId },
        include: {
          account: true,
          category: true,
          tags: { include: { tag: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      db().budget.findMany({ where: { userId }, include: { category: true }, take: 5 }),
      db().goal.findMany({ where: { userId }, take: 5 }),
      db().bill.findMany({
        where: { userId, status: 'unpaid' },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      db().recurringRule.findMany({
        where: { userId, status: 'active' },
        orderBy: { nextDate: 'asc' },
        take: 5,
      }),
      db().investment.findMany({ where: { userId } }),
      db().loan.findMany({ where: { userId } }),
      db().notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])
  },

  spentForBudget(userId, categoryId, from, to) {
    return db().transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
    })
  },
}
