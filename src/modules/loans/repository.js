import { db } from '../../lib/prisma.js'

export const loansRepository = {
  findManyByUser(userId) {
    return db().loan.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().loan.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().loan.create({ data })
  },

  update(id, data) {
    return db().loan.update({ where: { id }, data })
  },

  delete(id) {
    return db().loan.delete({ where: { id } })
  },
}
