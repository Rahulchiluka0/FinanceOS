import { db } from '../../lib/prisma.js'
import { checkBudgetAlerts } from '../../modules/budgets/alerts.js'

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

async function notifyOnce(userId, { type, title, body, meta = {} }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db().notification.findMany({
    where: { userId, type, createdAt: { gte: since } },
    select: { meta: true, title: true },
  })

  const already = recent.some((n) => {
    try {
      const m = typeof n.meta === 'string' ? JSON.parse(n.meta || '{}') : n.meta || {}
      if (meta.transactionId) return m.transactionId === meta.transactionId
      if (meta.billId) return m.billId === meta.billId
      if (meta.accountId) return m.accountId === meta.accountId
      if (meta.recurringId) {
        const kind = meta.kind || 'reminder'
        return m.recurringId === meta.recurringId && (m.kind || 'reminder') === kind
      }
      return n.title === title
    } catch {
      return n.title === title
    }
  })
  if (already) return false

  await db().notification.create({
    data: {
      userId,
      type,
      title,
      body,
      meta: JSON.stringify(meta),
    },
  })
  return true
}

/** Time-based reminders: budget catch-up, bills, low balance, upcoming recurring. */
export async function generateNotifications() {
  const users = await db().user.findMany({ select: { id: true } })
  const threshold = Number(process.env.LOW_BALANCE_THRESHOLD || 10000)
  const now = new Date()
  const soon = addDays(now, 3)
  const recurringSoon = addDays(now, 2)

  let created = 0

  for (const { id: userId } of users) {
    created += await checkBudgetAlerts(userId)

    const bills = await db().bill.findMany({
      where: {
        userId,
        status: 'unpaid',
        dueDate: { lte: soon },
      },
    })
    for (const bill of bills) {
      const due = bill.dueDate.toISOString().slice(0, 10)
      const ok = await notifyOnce(userId, {
        type: 'bill',
        title: 'Bill due',
        body: `${bill.title} of ₹${bill.amount.toLocaleString('en-IN')} is due on ${due}.`,
        meta: { billId: bill.id },
      })
      if (ok) created++
    }

    const accounts = await db().account.findMany({
      where: { userId, archived: false, balance: { lt: threshold } },
    })
    for (const account of accounts) {
      const ok = await notifyOnce(userId, {
        type: 'balance',
        title: 'Low balance',
        body: `${account.name} is below ₹${threshold.toLocaleString('en-IN')} (₹${account.balance.toLocaleString('en-IN')}).`,
        meta: { accountId: account.id },
      })
      if (ok) created++
    }

    const rules = await db().recurringRule.findMany({
      where: {
        userId,
        status: 'active',
        nextDate: { lte: recurringSoon },
      },
    })
    for (const rule of rules) {
      const next = rule.nextDate.toISOString().slice(0, 10)
      const ok = await notifyOnce(userId, {
        type: 'recurring',
        title: rule.accountId ? 'Recurring reminder' : 'Recurring needs account',
        body: rule.accountId
          ? `${rule.title} (₹${rule.amount.toLocaleString('en-IN')}) is scheduled for ${next}.`
          : `${rule.title} is due ${next}, but no account is linked — edit the rule to auto-create the transaction.`,
        meta: { recurringId: rule.id, kind: 'reminder' },
      })
      if (ok) created++
    }
  }

  return { users: users.length, created }
}
