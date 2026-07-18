import { db } from '../../lib/prisma.js'

export const goalsRepository = {
  findManyByUser(userId) {
    return db().goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().goal.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().goal.create({ data })
  },

  update(id, data) {
    return db().goal.update({ where: { id }, data })
  },

  delete(id) {
    return db().goal.delete({ where: { id } })
  },

  createNotification(data) {
    return db().notification.create({ data })
  },
}
