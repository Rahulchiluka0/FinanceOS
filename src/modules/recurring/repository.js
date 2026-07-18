import { db } from '../../lib/prisma.js'

export const recurringRepository = {
  findManyByUser(userId) {
    return db().recurringRule.findMany({
      where: { userId },
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().recurringRule.findFirst({
      where: { id, userId },
      include: { account: true, category: true },
    })
  },

  create(data) {
    return db().recurringRule.create({
      data,
      include: { account: true, category: true },
    })
  },

  update(id, data) {
    return db().recurringRule.update({
      where: { id },
      data,
      include: { account: true, category: true },
    })
  },

  async delete(id) {
    return db().$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { recurringId: id },
        data: { recurringId: null },
      })
      return tx.recurringRule.delete({ where: { id } })
    })
  },
}
