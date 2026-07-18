import { calendarRepository } from './repository.js'

function dateKey(d) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseMonthParam(month) {
  const m = Number(month)
  if (Number.isNaN(m)) return new Date().getMonth()
  if (m >= 1 && m <= 12) return m - 1
  if (m >= 0 && m <= 11) return m
  return new Date().getMonth()
}

function monthRange(year, monthIndex) {
  const from = new Date(year, monthIndex, 1)
  const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
  return { from, to }
}

export const calendarService = {
  async getMonth(userId, query = {}) {
    const year = Number(query.year) || new Date().getFullYear()
    const monthIndex = parseMonthParam(query.month)
    const { from, to } = monthRange(year, monthIndex)

    const [transactions, bills, recurring] = await Promise.all([
      calendarRepository.findTransactionsInMonth(userId, from, to),
      calendarRepository.findBillsInMonth(userId, from, to),
      calendarRepository.findRecurringInMonth(userId, from, to),
    ])

    const days = {}

    const ensureDay = (key) => {
      if (!days[key]) days[key] = { transactions: [], bills: [], recurring: [] }
      return days[key]
    }

    for (const t of transactions) {
      const key = dateKey(t.date)
      ensureDay(key).transactions.push({
        id: t.id,
        title: t.title,
        type: t.type,
        amount: t.amount,
        category: t.category?.name || null,
        account: t.account?.name || null,
      })
    }

    for (const b of bills) {
      const key = dateKey(b.dueDate)
      ensureDay(key).bills.push({
        id: b.id,
        title: b.title,
        amount: b.amount,
        status: b.status,
        category: b.category,
      })
    }

    for (const r of recurring) {
      const key = dateKey(r.nextDate)
      ensureDay(key).recurring.push({
        id: r.id,
        title: r.title,
        amount: r.amount,
        type: r.type,
        frequency: r.frequency,
      })
    }

    return days
  },
}
