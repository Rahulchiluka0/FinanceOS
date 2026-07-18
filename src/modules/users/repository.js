import { db } from '../../lib/prisma.js'

export const usersRepository = {
  findById(id) {
    return db().user.findUnique({ where: { id } })
  },

  update(id, data) {
    return db().user.update({ where: { id }, data })
  },
}
