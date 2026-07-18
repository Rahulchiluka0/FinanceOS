import { db } from '../../lib/prisma.js'
import { periodRange } from './alerts.js'

export const budgetsRepository = {
  findManyByUser(userId) {
    return db().budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().budget.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().budget.create({ data, include: { category: true } })
  },

  update(id, data) {
    return db().budget.update({ where: { id }, data, include: { category: true } })
  },

  delete(id) {
    return db().budget.delete({ where: { id } })
  },

  spentForCategory(userId, categoryId, period = 'monthly') {
    const { from, to } = periodRange(period)
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
