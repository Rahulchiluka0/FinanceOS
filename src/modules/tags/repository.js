import { db } from '../../lib/prisma.js'

const includeCount = { _count: { select: { transactions: true } } }

export const tagsRepository = {
  findManyByUser(userId) {
    return db().tag.findMany({
      where: { userId },
      include: includeCount,
      orderBy: { name: 'asc' },
    })
  },

  findByIdForUser(id, userId) {
    return db().tag.findFirst({ where: { id, userId } })
  },

  create(data) {
    return db().tag.create({ data })
  },

  update(id, data) {
    return db().tag.update({ where: { id }, data, include: includeCount })
  },

  async delete(id) {
    await db().transactionTag.deleteMany({ where: { tagId: id } })
    await db().tag.delete({ where: { id } })
  },
}
