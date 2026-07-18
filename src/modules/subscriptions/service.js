import { AppError } from '../../utils/response.js'
import { subscriptionsRepository } from './repository.js'

function formatCycle(cycle) {
  if (!cycle) return 'Monthly'
  return cycle.charAt(0).toUpperCase() + cycle.slice(1).toLowerCase()
}

function parseCycle(cycle) {
  return String(cycle || 'monthly').toLowerCase()
}

function mapSubscription(s) {
  return {
    id: s.id,
    name: s.name,
    amount: s.amount,
    cycle: formatCycle(s.cycle),
    nextRenewal: s.nextRenewal.toISOString().slice(0, 10),
    status: s.status,
  }
}

export const subscriptionsService = {
  async list(userId) {
    const rows = await subscriptionsRepository.findManyByUser(userId)
    return rows.map(mapSubscription)
  },

  async create(userId, body) {
    const sub = await subscriptionsRepository.create({
      userId,
      name: body.name,
      amount: body.amount,
      cycle: parseCycle(body.cycle),
      nextRenewal: new Date(body.nextRenewal),
      status: body.status || 'active',
    })
    return mapSubscription(sub)
  },

  async update(userId, id, body) {
    const existing = await subscriptionsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Subscription not found', 404)

    const sub = await subscriptionsRepository.update(existing.id, {
      name: body.name,
      amount: body.amount,
      cycle: body.cycle ? parseCycle(body.cycle) : undefined,
      nextRenewal: body.nextRenewal ? new Date(body.nextRenewal) : undefined,
      status: body.status,
    })
    return mapSubscription(sub)
  },

  async pause(userId, id) {
    const existing = await subscriptionsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Subscription not found', 404)

    const sub = await subscriptionsRepository.update(existing.id, { status: 'paused' })
    return mapSubscription(sub)
  },

  async resume(userId, id) {
    const existing = await subscriptionsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Subscription not found', 404)

    const sub = await subscriptionsRepository.update(existing.id, { status: 'active' })
    return mapSubscription(sub)
  },

  async remove(userId, id) {
    const existing = await subscriptionsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Subscription not found', 404)

    await subscriptionsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
