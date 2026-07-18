import { db } from '../../lib/prisma.js'

export const searchRepository = {
  searchTransactions(userId, q) {
    return db().transaction.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
      take: 20,
    })
  },

  searchAccounts(userId, q) {
    return db().account.findMany({
      where: {
        userId,
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      take: 10,
    })
  },

  searchBills(userId, q) {
    return db().bill.findMany({
      where: {
        userId,
        title: { contains: q, mode: 'insensitive' },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    })
  },

  searchGoals(userId, q) {
    return db().goal.findMany({
      where: {
        userId,
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      take: 10,
    })
  },
}
