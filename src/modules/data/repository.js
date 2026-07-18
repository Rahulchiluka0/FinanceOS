import { db } from '../../lib/prisma.js'

const txInclude = {
  account: true,
  toAccount: true,
  category: true,
  tags: { include: { tag: true } },
}

export const dataRepository = {
  findAccounts(userId) {
    return db().account.findMany({
      where: { userId, archived: false },
      orderBy: { name: 'asc' },
    })
  },

  findCategories(userId) {
    return db().category.findMany({
      where: { userId, archived: false },
      orderBy: { name: 'asc' },
    })
  },

  loadSnapshot(userId) {
    return Promise.all([
      db().account.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      db().category.findMany({
        where: { userId },
        include: { parent: true },
        orderBy: { name: 'asc' },
      }),
      db().transaction.findMany({
        where: { userId },
        include: txInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      db().budget.findMany({
        where: { userId },
        include: { category: true },
      }),
      db().goal.findMany({ where: { userId } }),
      db().bill.findMany({ where: { userId } }),
      db().tag.findMany({ where: { userId } }),
    ]).then(([accounts, categories, transactions, budgets, goals, bills, tags]) => ({
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      bills,
      tags,
    }))
  },
}
