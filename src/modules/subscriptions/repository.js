import { db } from '../../lib/prisma.js'

export const subscriptionsRepository = {
  findManyByUser(userId) {
    return db().subscription.findMany({
      where: { userId },
      orderBy: { nextRenewal: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().subscription.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().subscription.create({ data })
  },

  update(id, data) {
    return db().subscription.update({ where: { id }, data })
  },

  delete(id) {
    return db().subscription.delete({ where: { id } })
  },
}
