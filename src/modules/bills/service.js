import { AppError } from '../../utils/response.js'
import { accountsRepository } from '../accounts/repository.js'
import { billsRepository } from './repository.js'

function mapBill(b) {
  return {
    id: b.id,
    title: b.title,
    category: b.category,
    amount: b.amount,
    due: b.dueDate.toISOString().slice(0, 10),
    status: b.status,
    accountId: b.accountId,
    account: b.account?.name || null,
  }
}

export const billsService = {
  async list(userId) {
    const rows = await billsRepository.findManyByUser(userId)
    return rows.map(mapBill)
  },

  async create(userId, body) {
    const bill = await billsRepository.create({
      userId,
      title: body.title,
      category: body.category,
      amount: body.amount,
      dueDate: new Date(body.dueDate),
      accountId: body.accountId || null,
      status: body.status || 'unpaid',
    })
    return mapBill(bill)
  },

  async update(userId, id, body) {
    const existing = await billsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Bill not found', 404)

    const bill = await billsRepository.update(existing.id, {
      title: body.title,
      category: body.category,
      amount: body.amount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      accountId: body.accountId,
      status: body.status,
    })
    return mapBill(bill)
  },

  async pay(userId, id) {
    const existing = await billsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Bill not found', 404)
    if (existing.status === 'paid') throw new AppError('Bill is already paid')

    const accountId = existing.accountId
    if (accountId) {
      const account = await accountsRepository.findByIdForUser(accountId, userId)
      if (!account) throw new AppError('Account not found', 404)
    }

    const bill = await billsRepository.payBill({ userId, bill: existing, accountId })
    return mapBill(bill)
  },

  async remove(userId, id) {
    const existing = await billsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Bill not found', 404)

    await billsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
