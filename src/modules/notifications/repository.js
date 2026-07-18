import { db } from '../../lib/prisma.js'

export const notificationsRepository = {
  findManyByUser(userId, unreadOnly = false) {
    return db().notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().notification.findFirst({ where: { id, userId } })
  },

  markRead(id) {
    return db().notification.update({
      where: { id },
      data: { read: true },
    })
  },

  markAllRead(userId) {
    return db().notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  },
}
