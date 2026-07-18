import { db } from '../../lib/prisma.js'

export const calendarRepository = {
  findTransactionsInMonth(userId, from, to) {
    return db().transaction.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { category: true, account: true },
      orderBy: { date: 'asc' },
    })
  },

  findBillsInMonth(userId, from, to) {
    return db().bill.findMany({
      where: { userId, dueDate: { gte: from, lte: to } },
      orderBy: { dueDate: 'asc' },
    })
  },

  findRecurringInMonth(userId, from, to) {
    return db().recurringRule.findMany({
      where: {
        userId,
        status: 'active',
        nextDate: { gte: from, lte: to },
      },
      orderBy: { nextDate: 'asc' },
    })
  },
}
