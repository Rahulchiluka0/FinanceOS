import { db } from '../../lib/prisma.js'

const includeParent = { parent: true }

export const categoriesRepository = {
  findManyByUser(userId) {
    return db().category.findMany({
      where: { userId },
      include: includeParent,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
  },

  findByIdForUser(id, userId) {
    return db().category.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().category.create({ data, include: includeParent })
  },

  update(id, data) {
    return db().category.update({ where: { id }, data, include: includeParent })
  },
}
