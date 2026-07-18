import { db } from '../../lib/prisma.js'
import { assertCanDebit } from '../../utils/balance.js'

export const includeTx = {
  account: true,
  toAccount: true,
  category: true,
  tags: { include: { tag: true } },
}

async function applyBalanceDelta(tx, { type, accountId, toAccountId, amount, reverse = false }) {
  const signed = reverse ? -amount : amount
  if (type === 'income') {
    await tx.account.update({ where: { id: accountId }, data: { balance: { increment: signed } } })
  } else if (type === 'expense') {
    await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: signed } } })
  } else if (type === 'transfer') {
    await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: signed } } })
    if (toAccountId) {
      await tx.account.update({ where: { id: toAccountId }, data: { balance: { increment: signed } } })
    }
  }
}

async function syncTags(tx, userId, transactionId, tagNames = []) {
  await tx.transactionTag.deleteMany({ where: { transactionId } })
  for (const raw of tagNames) {
    const name = String(raw).replace(/^#/, '').trim().toLowerCase()
    if (!name) continue
    const tag = await tx.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, color: '#1A56DB' },
      update: {},
    })
    await tx.transactionTag.create({
      data: { transactionId, tagId: tag.id },
    })
  }
}

const orderBy = [{ date: 'desc' }, { createdAt: 'desc' }]

export const transactionsRepository = {
  findMany(userId, where) {
    return db().transaction.findMany({
      where: { userId, ...where },
      include: includeTx,
      orderBy,
    })
  },

  async findManyPaged(userId, where, { skip, take }) {
    const filter = { userId, ...where }
    const [rows, total] = await Promise.all([
      db().transaction.findMany({
        where: filter,
        include: includeTx,
        orderBy,
        skip,
        take,
      }),
      db().transaction.count({ where: filter }),
    ])
    return { rows, total }
  },

  findByIdForUser(id, userId, include = includeTx) {
    return db().transaction.findFirst({ where: { id, userId }, include })
  },

  findManyByIds(userId, ids) {
    return db().transaction.findMany({
      where: { userId, id: { in: ids } },
    })
  },

  update(id, data) {
    return db().transaction.update({ where: { id }, data, include: includeTx })
  },

  createWithBalanceAndTags(userId, data, tagNames) {
    return db().$transaction(async (tx) => {
      if (data.type === 'expense' || data.type === 'transfer') {
        const account = await tx.account.findFirst({ where: { id: data.accountId } })
        assertCanDebit(account, data.amount)
      }
      const row = await tx.transaction.create({ data: { userId, ...data } })
      await applyBalanceDelta(tx, data)
      await syncTags(tx, userId, row.id, tagNames)
      return tx.transaction.findUnique({ where: { id: row.id }, include: includeTx })
    })
  },

  updateWithBalanceAndTags(userId, existing, next, tagNames) {
    return db().$transaction(async (tx) => {
      await applyBalanceDelta(tx, {
        type: existing.type,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        amount: existing.amount,
        reverse: true,
      })
      if (next.type === 'expense' || next.type === 'transfer') {
        const account = await tx.account.findFirst({ where: { id: next.accountId } })
        assertCanDebit(account, next.amount)
      }
      const row = await tx.transaction.update({
        where: { id: existing.id },
        data: next,
      })
      await applyBalanceDelta(tx, next)
      if (tagNames !== undefined) await syncTags(tx, userId, row.id, tagNames)
      return tx.transaction.findUnique({ where: { id: row.id }, include: includeTx })
    })
  },

  deleteWithBalance(existing) {
    return db().$transaction(async (tx) => {
      await applyBalanceDelta(tx, {
        type: existing.type,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        amount: existing.amount,
        reverse: true,
      })
      await tx.transactionTag.deleteMany({ where: { transactionId: existing.id } })
      await tx.transaction.delete({ where: { id: existing.id } })
    })
  },

  bulkDeleteWithBalance(rows) {
    return db().$transaction(async (tx) => {
      for (const row of rows) {
        await applyBalanceDelta(tx, {
          type: row.type,
          accountId: row.accountId,
          toAccountId: row.toAccountId,
          amount: row.amount,
          reverse: true,
        })
        await tx.transactionTag.deleteMany({ where: { transactionId: row.id } })
        await tx.transaction.delete({ where: { id: row.id } })
      }
    })
  },

  duplicateWithBalanceAndTags(userId, existing, tagNames) {
    return db().$transaction(async (tx) => {
      const row = await tx.transaction.create({
        data: {
          userId,
          title: `${existing.title} (copy)`,
          type: existing.type,
          amount: existing.amount,
          accountId: existing.accountId,
          toAccountId: existing.toAccountId,
          categoryId: existing.categoryId,
          date: existing.date,
          notes: existing.notes,
          favorite: false,
          receiptUrl: existing.receiptUrl,
        },
      })
      await applyBalanceDelta(tx, existing)
      await syncTags(tx, userId, row.id, tagNames)
      return tx.transaction.findUnique({ where: { id: row.id }, include: includeTx })
    })
  },
}
