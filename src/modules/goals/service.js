import { AppError } from '../../utils/response.js'
import { goalsRepository } from './repository.js'

function mapGoal(g) {
  return {
    id: g.id,
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    deadline: g.deadline ? g.deadline.toISOString().slice(0, 10) : null,
    color: g.color,
    completed: g.completed,
  }
}

export const goalsService = {
  async list(userId) {
    const goals = await goalsRepository.findManyByUser(userId)
    return goals.map(mapGoal)
  },

  async create(userId, body) {
    const current = body.currentAmount || 0
    const goal = await goalsRepository.create({
      userId,
      name: body.name,
      targetAmount: body.targetAmount,
      currentAmount: current,
      deadline: body.deadline ? new Date(body.deadline) : null,
      color: body.color || '#1A56DB',
      completed: current >= body.targetAmount,
    })
    return mapGoal(goal)
  },

  async update(userId, id, body) {
    const existing = await goalsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Goal not found', 404)

    const target = body.targetAmount ?? existing.targetAmount
    const current = body.currentAmount ?? existing.currentAmount

    const goal = await goalsRepository.update(existing.id, {
      name: body.name,
      targetAmount: body.targetAmount,
      currentAmount: body.currentAmount,
      deadline:
        body.deadline === undefined ? undefined : body.deadline ? new Date(body.deadline) : null,
      color: body.color,
      completed: current >= target,
    })
    return mapGoal(goal)
  },

  async remove(userId, id) {
    const existing = await goalsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Goal not found', 404)

    await goalsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },

  async deposit(userId, id, amount) {
    const existing = await goalsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Goal not found', 404)

    const current = existing.currentAmount + amount
    const goal = await goalsRepository.update(existing.id, {
      currentAmount: current,
      completed: current >= existing.targetAmount,
    })

    if (goal.completed && !existing.completed) {
      await goalsRepository.createNotification({
        userId,
        type: 'goal',
        title: 'Goal completed',
        body: `${goal.name} reached its target!`,
      })
    }
    return mapGoal(goal)
  },

  async withdraw(userId, id, amount) {
    const existing = await goalsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Goal not found', 404)
    if (amount <= 0) throw new AppError('Amount must be greater than zero')
    if (amount > existing.currentAmount) {
      throw new AppError(
        `Cannot withdraw more than saved (₹${Number(existing.currentAmount).toLocaleString('en-IN')} available)`,
      )
    }

    const current = existing.currentAmount - amount
    const goal = await goalsRepository.update(existing.id, {
      currentAmount: current,
      completed: current >= existing.targetAmount,
    })
    return mapGoal(goal)
  },
}
