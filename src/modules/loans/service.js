import { AppError } from '../../utils/response.js'
import { loansRepository } from './repository.js'

function mapLoan(l) {
  return {
    id: l.id,
    name: l.name,
    principal: l.principal,
    remaining: l.remaining,
    rate: l.interestRate,
    emi: l.emi,
    nextDue: l.nextDue ? l.nextDue.toISOString().slice(0, 10) : null,
    tenureMonths: l.tenureMonths,
    paidMonths: l.paidMonths,
  }
}

function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export const loansService = {
  async list(userId) {
    const rows = await loansRepository.findManyByUser(userId)
    return rows.map(mapLoan)
  },

  async create(userId, body) {
    const loan = await loansRepository.create({
      userId,
      name: body.name,
      principal: body.principal,
      remaining: body.remaining ?? body.principal,
      interestRate: body.interestRate,
      emi: body.emi,
      nextDue: body.nextDue ? new Date(body.nextDue) : null,
      tenureMonths: body.tenureMonths,
      paidMonths: body.paidMonths ?? 0,
    })
    return mapLoan(loan)
  },

  async update(userId, id, body) {
    const existing = await loansRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Loan not found', 404)

    const loan = await loansRepository.update(existing.id, {
      name: body.name,
      principal: body.principal,
      remaining: body.remaining,
      interestRate: body.interestRate,
      emi: body.emi,
      nextDue:
        body.nextDue === undefined ? undefined : body.nextDue ? new Date(body.nextDue) : null,
      tenureMonths: body.tenureMonths,
      paidMonths: body.paidMonths,
    })
    return mapLoan(loan)
  },

  async remove(userId, id) {
    const existing = await loansRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Loan not found', 404)

    await loansRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },

  async schedule(userId, id) {
    const loan = await loansRepository.findByIdForUser(id, userId)
    if (!loan) throw new AppError('Loan not found', 404)

    const schedule = []
    let remaining = loan.remaining
    const baseDue = loan.nextDue || new Date()
    const remainingMonths = loan.tenureMonths - loan.paidMonths

    for (let i = 0; i < remainingMonths && remaining > 0; i++) {
      const amount = Math.min(loan.emi, remaining)
      remaining = Math.max(0, remaining - amount)
      schedule.push({
        month: loan.paidMonths + i + 1,
        dueDate: addMonths(baseDue, i).toISOString().slice(0, 10),
        amount,
        remaining: Math.round(remaining * 100) / 100,
      })
    }

    return schedule
  },
}
