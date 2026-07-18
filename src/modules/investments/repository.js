import { db } from '../../lib/prisma.js'

export const investmentsRepository = {
  findManyByUser(userId) {
    return db().investment.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().investment.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().investment.create({ data })
  },

  update(id, data) {
    return db().investment.update({ where: { id }, data })
  },

  delete(id) {
    return db().investment.delete({ where: { id } })
  },
}
