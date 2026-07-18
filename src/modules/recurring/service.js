import { AppError } from '../../utils/response.js'
import { recurringRepository } from './repository.js'

function mapRecurring(r) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    amount: r.amount,
    frequency: r.frequency.charAt(0).toUpperCase() + r.frequency.slice(1),
    nextDate: r.nextDate.toISOString().slice(0, 10),
    status: r.status,
    accountId: r.accountId,
    categoryId: r.categoryId,
    account: r.account?.name || null,
    category: r.category?.name || null,
  }
}

function advanceDate(date, frequency) {
  const d = new Date(date)
  const f = frequency.toLowerCase()
  if (f === 'daily') d.setDate(d.getDate() + 1)
  else if (f === 'weekly') d.setDate(d.getDate() + 7)
  else if (f === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

export const recurringService = {
  async list(userId) {
    const rows = await recurringRepository.findManyByUser(userId)
    return rows.map(mapRecurring)
  },

  async create(userId, body) {
    if (!body.accountId) throw new AppError('Account is required for recurring rules')

    const row = await recurringRepository.create({
      userId,
      title: body.title,
      type: body.type,
      amount: body.amount,
      frequency: body.frequency,
      nextDate: new Date(body.nextDate),
      accountId: body.accountId,
      categoryId: body.categoryId || null,
      status: 'active',
    })
    return mapRecurring(row)
  },

  async update(userId, id, body) {
    const existing = await recurringRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Recurring rule not found', 404)

    const data = {}
    if (body.title !== undefined) data.title = body.title
    if (body.type !== undefined) data.type = body.type
    if (body.amount !== undefined) data.amount = body.amount
    if (body.frequency !== undefined) data.frequency = body.frequency
    if (body.nextDate !== undefined) data.nextDate = new Date(body.nextDate)
    if (body.accountId !== undefined) data.accountId = body.accountId
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.status !== undefined) data.status = body.status

    const row = await recurringRepository.update(existing.id, data)
    return mapRecurring(row)
  },

  async setStatus(userId, id, status) {
    const existing = await recurringRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Recurring rule not found', 404)

    const row = await recurringRepository.update(existing.id, { status })
    return mapRecurring(row)
  },

  async skip(userId, id) {
    const existing = await recurringRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Recurring rule not found', 404)

    const row = await recurringRepository.update(existing.id, {
      nextDate: advanceDate(existing.nextDate, existing.frequency),
    })
    return mapRecurring(row)
  },

  async remove(userId, id) {
    const existing = await recurringRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Recurring rule not found', 404)

    await recurringRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
