import { db } from '../../lib/prisma.js'

export const userRepository = {
  findByEmail(email) {
    return db().user.findUnique({ where: { email: email.toLowerCase() } })
  },

  findById(id) {
    return db().user.findUnique({ where: { id } })
  },

  create(data) {
    return db().user.create({ data })
  },

  update(id, data) {
    return db().user.update({ where: { id }, data })
  },

  createResetToken(data) {
    return db().passwordResetToken.create({ data })
  },

  findResetToken(tokenHash) {
    return db().passwordResetToken.findUnique({ where: { tokenHash } })
  },

  markResetTokenUsed(id) {
    return db().passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  },

  invalidateResetTokens(userId) {
    return db().passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
  },
}
