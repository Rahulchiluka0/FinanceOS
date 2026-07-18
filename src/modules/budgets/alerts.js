import { db } from '../../lib/prisma.js'

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function periodRange(period, now = new Date()) {
  const p = String(period || 'monthly').toLowerCase()
  const end = new Date(now)

  if (p === 'weekly') {
    const day = now.getDay() // 0 Sun
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = startOfDay(now)
    start.setDate(start.getDate() + mondayOffset)
    return { from: start, to: end }
  }

  if (p === 'yearly') {
    return { from: new Date(now.getFullYear(), 0, 1), to: end }
  }

  // monthly (default)
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end }
}

async function notifyBudgetOnce(userId, { type, title, body, meta }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db().notification.findMany({
    where: { userId, type, createdAt: { gte: since } },
    select: { meta: true },
  })
  const already = recent.some((n) => {
    try {
      const m = typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta
      return m?.budgetId === meta.budgetId && m?.level === meta.level
    } catch {
      return false
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

export async function spentForCategoryPeriod(userId, categoryId, period) {
  const { from, to } = periodRange(period)
  const agg = await db().transaction.aggregate({
    where: {
      userId,
      categoryId,
      type: 'expense',
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  })
  return agg._sum.amount || 0
}

/** Create budget / over-budget notifications for matching budgets. */
export async function checkBudgetAlerts(userId, categoryId = null) {
  const budgets = await db().budget.findMany({
    where: {
      userId,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
  })

  let created = 0
  for (const b of budgets) {
    const spent = await spentForCategoryPeriod(userId, b.categoryId, b.period)
    const limit = Number(b.limitAmount) || 0
    if (limit <= 0) continue
    const pct = Math.round((spent / limit) * 100)
    const alertAt = b.alertAt ?? 80

    if (pct < alertAt) continue

    const over = pct >= 100
    const ok = await notifyBudgetOnce(userId, {
      type: 'budget',
      title: over ? 'Over budget' : 'Budget alert',
      body: over
        ? `${b.category.name} is over its ₹${limit.toLocaleString('en-IN')} ${b.period} limit (₹${spent.toLocaleString('en-IN')} spent · ${pct}%).`
        : `${b.category.name} is at ${pct}% of its ₹${limit.toLocaleString('en-IN')} ${b.period} limit (₹${spent.toLocaleString('en-IN')} spent).`,
      meta: { budgetId: b.id, pct, level: over ? 'over' : 'alert' },
    })
    if (ok) created++
  }
  return created
}
