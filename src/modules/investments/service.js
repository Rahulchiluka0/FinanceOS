import { AppError } from '../../utils/response.js'
import { investmentsRepository } from './repository.js'

function mapInvestment(i) {
  return {
    id: i.id,
    name: i.name,
    type: i.type,
    invested: i.invested,
    value: i.currentValue,
    pl: i.currentValue - i.invested,
  }
}

export const investmentsService = {
  async list(userId) {
    const rows = await investmentsRepository.findManyByUser(userId)
    return rows.map(mapInvestment)
  },

  async create(userId, body) {
    const inv = await investmentsRepository.create({
      userId,
      name: body.name,
      type: body.type,
      invested: body.invested,
      currentValue: body.currentValue ?? body.invested,
    })
    return mapInvestment(inv)
  },

  async update(userId, id, body) {
    const existing = await investmentsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Investment not found', 404)

    const inv = await investmentsRepository.update(existing.id, {
      name: body.name,
      type: body.type,
      invested: body.invested,
      currentValue: body.currentValue ?? body.value,
    })
    return mapInvestment(inv)
  },

  async remove(userId, id) {
    const existing = await investmentsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Investment not found', 404)

    await investmentsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
