import { AppError } from '../../utils/response.js'
import { assertCanDebit } from '../../utils/balance.js'
import { mapAccount, parseAccountType } from '../../utils/mappers.js'
import { markTwinStale } from '../ai/twin/invalidate.js'
import { accountsRepository } from './repository.js'

export const accountsService = {
  async list(userId, query = {}) {
    const archived =
      query.archived === undefined ? undefined : query.archived === 'true' || query.archived === true
    const rows = await accountsRepository.findManyByUser(userId, archived)
    return rows.map(mapAccount)
  },

  async create(userId, body) {
    const opening = body.openingBalance ?? 0
    const account = await accountsRepository.create({
      userId,
      name: body.name,
      type: parseAccountType(body.type),
      openingBalance: opening,
      balance: body.balance ?? opening,
      color: body.color || '#1A56DB',
      currency: body.currency || 'INR',
    })
    await markTwinStale(userId)
    return mapAccount(account)
  },

  async update(userId, id, body) {
    const existing = await accountsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Account not found', 404)

    const account = await accountsRepository.update(existing.id, {
      name: body.name,
      type: body.type ? parseAccountType(body.type) : undefined,
      openingBalance: body.openingBalance,
      balance: body.balance,
      color: body.color,
      archived: body.archived,
    })
    await markTwinStale(userId)
    return mapAccount(account)
  },

  async toggleArchive(userId, id) {
    const existing = await accountsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Account not found', 404)
    const account = await accountsRepository.update(existing.id, {
      archived: !existing.archived,
    })
    await markTwinStale(userId)
    return mapAccount(account)
  },

  async transfer(userId, body) {
    if (body.fromId === body.toId) throw new AppError('Cannot transfer to the same account')

    const [from, to] = await Promise.all([
      accountsRepository.findByIdForUser(body.fromId, userId),
      accountsRepository.findByIdForUser(body.toId, userId),
    ])
    if (!from || !to) throw new AppError('Account not found', 404)
    if (from.archived || to.archived) throw new AppError('Cannot transfer with an archived account')
    assertCanDebit(from, body.amount)

    const result = await accountsRepository.transfer({
      userId,
      fromId: from.id,
      toId: to.id,
      amount: body.amount,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes,
    })

    await markTwinStale(userId)
    return { from: mapAccount(result.from), to: mapAccount(result.to) }
  },
}
