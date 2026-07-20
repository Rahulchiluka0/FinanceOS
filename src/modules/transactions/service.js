import { AppError } from '../../utils/response.js'
import { mapTransaction } from '../../utils/mappers.js'
import { db } from '../../lib/prisma.js'
import { checkBudgetAlerts } from '../budgets/alerts.js'
import { markTwinStale } from '../ai/twin/invalidate.js'
import { scheduleCoachEvaluate } from '../ai/coach/schedule.js'
import { transactionsRepository } from './repository.js'

async function maybeBudgetAlert(userId, type, categoryId) {
  if (type !== 'expense' || !categoryId) return
  try {
    await checkBudgetAlerts(userId, categoryId)
  } catch (err) {
    console.error('[budget-alert]', err.message)
  }
}

function buildListWhere(userId, query) {
  const { type, q, tag } = query
  return {
    ...(type && type !== 'all' ? { type: String(type) } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: String(q), mode: 'insensitive' } },
            { notes: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(tag
      ? { tags: { some: { tag: { name: String(tag).toLowerCase(), userId } } } }
      : {}),
  }
}

async function validateAccounts(userId, body) {
  const account = await db().account.findFirst({
    where: { id: body.accountId, userId },
  })
  if (!account) throw new AppError('Account not found', 404)

  if (body.type === 'transfer') {
    if (!body.toAccountId) throw new AppError('toAccountId required for transfer')
    const to = await db().account.findFirst({
      where: { id: body.toAccountId, userId },
    })
    if (!to) throw new AppError('Destination account not found', 404)
  }
}

export const transactionsService = {
  async list(userId, query = {}) {
    const where = buildListWhere(userId, query)
    const hasPage = query.page != null && String(query.page).trim() !== ''
    const hasLimit =
      (query.limit != null && String(query.limit).trim() !== '') ||
      (query.pageSize != null && String(query.pageSize).trim() !== '')

    // Backward compatible: no page/limit → return full list
    if (!hasPage && !hasLimit) {
      const rows = await transactionsRepository.findMany(userId, where)
      return { items: rows.map(mapTransaction), meta: null }
    }

    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.limit || query.pageSize) || 20))
    const { rows, total } = await transactionsRepository.findManyPaged(userId, where, {
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      items: rows.map(mapTransaction),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  },

  async create(userId, body) {
    await validateAccounts(userId, body)

    const created = await transactionsRepository.createWithBalanceAndTags(
      userId,
      {
        title: body.title,
        type: body.type,
        amount: body.amount,
        accountId: body.accountId,
        toAccountId: body.type === 'transfer' ? body.toAccountId : null,
        categoryId: body.categoryId || null,
        date: body.date ? new Date(body.date) : new Date(),
        notes: body.notes || '',
        favorite: body.favorite || false,
        receiptUrl: body.receiptUrl || null,
      },
      body.tags || [],
    )
    await maybeBudgetAlert(userId, created.type, created.categoryId)
    await markTwinStale(userId)
    scheduleCoachEvaluate(userId, created.type === 'income' ? 'income' : 'expense')
    return mapTransaction(created)
  },

  async update(userId, id, body) {
    const existing = await transactionsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Transaction not found', 404)

    const next = {
      title: body.title ?? existing.title,
      type: body.type ?? existing.type,
      amount: body.amount ?? existing.amount,
      accountId: body.accountId ?? existing.accountId,
      toAccountId: body.toAccountId !== undefined ? body.toAccountId : existing.toAccountId,
      categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
      date: body.date ? new Date(body.date) : existing.date,
      notes: body.notes ?? existing.notes,
      favorite: body.favorite ?? existing.favorite,
      receiptUrl: body.receiptUrl !== undefined ? body.receiptUrl : existing.receiptUrl,
    }

    const updated = await transactionsRepository.updateWithBalanceAndTags(
      userId,
      existing,
      next,
      body.tags,
    )
    await maybeBudgetAlert(userId, updated.type, updated.categoryId)
    if (existing.categoryId && existing.categoryId !== updated.categoryId) {
      await maybeBudgetAlert(userId, 'expense', existing.categoryId)
    }
    await markTwinStale(userId)
    scheduleCoachEvaluate(userId, 'expense')
    return mapTransaction(updated)
  },

  async remove(userId, id) {
    const existing = await transactionsRepository.findByIdForUser(id, userId, false)
    if (!existing) throw new AppError('Transaction not found', 404)

    await transactionsRepository.deleteWithBalance(existing)
    await markTwinStale(userId)
    return { id: existing.id, deleted: true }
  },

  async bulkRemove(userId, ids) {
    const rows = await transactionsRepository.findManyByIds(userId, ids)
    await transactionsRepository.bulkDeleteWithBalance(rows)
    await markTwinStale(userId)
    return { deleted: rows.map((r) => r.id) }
  },

  async duplicate(userId, id) {
    const existing = await transactionsRepository.findByIdForUser(id, userId, {
      tags: { include: { tag: true } },
    })
    if (!existing) throw new AppError('Transaction not found', 404)

    const created = await transactionsRepository.duplicateWithBalanceAndTags(
      userId,
      existing,
      existing.tags.map((t) => t.tag.name),
    )
    await maybeBudgetAlert(userId, created.type, created.categoryId)
    await markTwinStale(userId)
    scheduleCoachEvaluate(userId, 'expense')
    return mapTransaction(created)
  },

  async toggleFavorite(userId, id) {
    const existing = await transactionsRepository.findByIdForUser(id, userId, false)
    if (!existing) throw new AppError('Transaction not found', 404)

    const row = await transactionsRepository.update(existing.id, {
      favorite: !existing.favorite,
    })
    return mapTransaction(row)
  },
}
