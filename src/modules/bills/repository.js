import { db } from '../../lib/prisma.js'

const includeBill = { account: true }

export const billsRepository = {
  findManyByUser(userId) {
    return db().bill.findMany({
      where: { userId },
      include: includeBill,
      orderBy: { dueDate: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().bill.findFirst({ where: { id, userId }, include: includeBill })
  },

  create(data) {
    return db().bill.create({ data, include: includeBill })
  },

  update(id, data) {
    return db().bill.update({ where: { id }, data, include: includeBill })
  },

  delete(id) {
    return db().bill.delete({ where: { id } })
  },

  payBill({ userId, bill, accountId }) {
    return db().$transaction(async (tx) => {
      const updated = await tx.bill.update({
        where: { id: bill.id },
        data: { status: 'paid' },
        include: includeBill,
      })

      if (accountId) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: bill.amount } },
        })
        await tx.transaction.create({
          data: {
            userId,
            accountId,
            type: 'expense',
            title: bill.title,
            amount: bill.amount,
            date: new Date(),
            notes: `Bill payment: ${bill.category}`,
          },
        })
      }

      return updated
    })
  },
}
