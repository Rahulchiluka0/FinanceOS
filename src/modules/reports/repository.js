import { db } from '../../lib/prisma.js'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const reportsRepository = {
  aggregateIncome(userId, from, to) {
    return db().transaction.aggregate({
      where: { userId, type: 'income', date: { gte: from, lte: to } },
      _sum: { amount: true },
    })
  },

  aggregateExpense(userId, from, to) {
    return db().transaction.aggregate({
      where: { userId, type: 'expense', date: { gte: from, lte: to } },
      _sum: { amount: true },
    })
  },

  expenseByCategory(userId, from, to) {
    return db().transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'expense', date: { gte: from, lte: to }, categoryId: { not: null } },
      _sum: { amount: true },
    })
  },

  findCategoriesByIds(ids) {
    return db().category.findMany({ where: { id: { in: ids } } })
  },
}

export { MONTH_LABELS }
