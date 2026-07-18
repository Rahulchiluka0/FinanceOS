import { db } from '../../lib/prisma.js'
import { assertCanDebit } from '../../utils/balance.js'

export const accountsRepository = {
  findManyByUser(userId, archivedFilter) {
    return db().account.findMany({
      where: {
        userId,
        ...(archivedFilter === undefined ? {} : { archived: archivedFilter }),
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().account.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().account.create({ data })
  },

  update(id, data) {
    return db().account.update({ where: { id }, data })
  },

  async transfer({ userId, fromId, toId, amount, date, notes }) {
    return db().$transaction(async (tx) => {
      const from = await tx.account.findFirst({ where: { id: fromId } })
      assertCanDebit(from, amount)

      const updatedFrom = await tx.account.update({
        where: { id: fromId },
        data: { balance: { decrement: amount } },
      })
      const updatedTo = await tx.account.update({
        where: { id: toId },
        data: { balance: { increment: amount } },
      })
      await tx.transaction.create({
        data: {
          userId,
          accountId: fromId,
          toAccountId: toId,
          type: 'transfer',
          title: `Transfer to ${updatedTo.name}`,
          amount,
          date,
          notes: notes || '',
        },
      })
      return { from: updatedFrom, to: updatedTo }
    })
  },
}
