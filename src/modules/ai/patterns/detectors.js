import { db } from '../../../lib/prisma.js'
import { startOfMonth, endOfMonth } from '../../../utils/mappers.js'

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function clusterTitles(transactions, limit = 5) {
  const map = new Map()
  for (const t of transactions) {
    const key = String(t.title || 'Unknown')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 48)
    if (!key) continue
    const prev = map.get(key) || { title: t.title, amount: 0, count: 0 }
    prev.amount += t.amount
    prev.count += 1
    map.set(key, prev)
  }
  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((x) => ({
      title: x.title,
      amount: round2(x.amount),
      count: x.count,
    }))
}

function weekendLift(expenses) {
  if (!expenses.length) return { liftPct: 0, weekendAvg: 0, weekdayAvg: 0 }
  let weekend = 0
  let weekday = 0
  let wCount = 0
  let dCount = 0
  for (const t of expenses) {
    const day = new Date(t.date).getDay()
    const isWeekend = day === 0 || day === 6
    if (isWeekend) {
      weekend += t.amount
      wCount += 1
    } else {
      weekday += t.amount
      dCount += 1
    }
  }
  const weekendAvg = wCount ? weekend / wCount : 0
  const weekdayAvg = dCount ? weekday / dCount : 0
  const liftPct =
    weekdayAvg <= 0 ? (weekendAvg > 0 ? 100 : 0) : Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
  return { liftPct, weekendAvg: round2(weekendAvg), weekdayAvg: round2(weekdayAvg) }
}

function postPaydayLift(expenses, incomes) {
  if (!incomes.length || !expenses.length) {
    return { liftPct: 0, payday: null }
  }
  const largest = [...incomes].sort((a, b) => b.amount - a.amount)[0]
  const payday = new Date(largest.date)
  payday.setHours(0, 0, 0, 0)

  let near = 0
  let nearCount = 0
  let other = 0
  let otherCount = 0

  for (const t of expenses) {
    const d = new Date(t.date)
    d.setHours(0, 0, 0, 0)
    const diff = (d - payday) / (24 * 60 * 60 * 1000)
    if (diff >= 0 && diff <= 5) {
      near += t.amount
      nearCount += 1
    } else {
      other += t.amount
      otherCount += 1
    }
  }

  const nearAvg = nearCount ? near / nearCount : 0
  const otherAvg = otherCount ? other / otherCount : 0
  const liftPct =
    otherAvg <= 0 ? (nearAvg > 0 ? 100 : 0) : Math.round(((nearAvg - otherAvg) / otherAvg) * 100)

  return {
    liftPct,
    payday: payday.toISOString().slice(0, 10),
    incomeAmount: round2(largest.amount),
    nearAvg: round2(nearAvg),
    otherAvg: round2(otherAvg),
  }
}

function subscriptionMonthly(amount, cycle) {
  const c = String(cycle || 'monthly').toLowerCase()
  if (c === 'yearly' || c === 'annual') return amount / 12
  if (c === 'quarterly') return amount / 3
  if (c === 'weekly') return (amount * 52) / 12
  return amount
}

/**
 * Run Phase B detectors and upsert AiPattern rows for the period.
 * @returns {{ period: string, patterns: object[] }}
 */
export async function detectAndStorePatterns(userId, { period } = {}) {
  const now = new Date()
  const periodKey = period || monthKey(now)
  const [y, m] = periodKey.split('-').map(Number)
  const from = new Date(y, m - 1, 1)
  const to = endOfMonth(from)
  const prevFrom = startOfMonth(addMonths(from, -1))
  const prevTo = endOfMonth(prevFrom)

  const [expenses, incomes, prevExpenses, categories, subscriptions, historyNets] =
    await Promise.all([
      db().transaction.findMany({
        where: { userId, type: 'expense', date: { gte: from, lte: to } },
        select: { id: true, title: true, amount: true, date: true, categoryId: true },
      }),
      db().transaction.findMany({
        where: { userId, type: 'income', date: { gte: from, lte: to } },
        select: { id: true, title: true, amount: true, date: true },
      }),
      db().transaction.findMany({
        where: { userId, type: 'expense', date: { gte: prevFrom, lte: prevTo } },
        select: { amount: true, categoryId: true },
      }),
      db().category.findMany({
        where: { userId, archived: false },
        select: { id: true, name: true },
      }),
      db().subscription.findMany({ where: { userId } }),
      Promise.all(
        Array.from({ length: 6 }, async (_, i) => {
          const start = startOfMonth(addMonths(now, -(5 - i)))
          const end = endOfMonth(start)
          const [inc, exp] = await Promise.all([
            db().transaction.aggregate({
              where: { userId, type: 'income', date: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
            db().transaction.aggregate({
              where: { userId, type: 'expense', date: { gte: start, lte: end } },
              _sum: { amount: true },
            }),
          ])
          return (inc._sum.amount || 0) - (exp._sum.amount || 0)
        }),
      ),
    ])

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const totalSpend = expenses.reduce((s, t) => s + t.amount, 0)
  const byCat = new Map()
  for (const t of expenses) {
    const id = t.categoryId || '_none'
    byCat.set(id, (byCat.get(id) || 0) + t.amount)
  }
  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({
      categoryId: id === '_none' ? null : id,
      name: id === '_none' ? 'Uncategorized' : catName.get(id) || 'Category',
      amount: round2(amount),
      sharePct: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))

  const topMerchants = clusterTitles(expenses).map((m) => ({
    ...m,
    sharePct: totalSpend > 0 ? Math.round((m.amount / totalSpend) * 100) : 0,
  }))

  const weekend = weekendLift(expenses)
  const payday = postPaydayLift(expenses, incomes)

  const prevByCat = new Map()
  for (const t of prevExpenses) {
    const id = t.categoryId || '_none'
    prevByCat.set(id, (prevByCat.get(id) || 0) + t.amount)
  }
  const momGrowth = topCategories
    .map((c) => {
      const key = c.categoryId || '_none'
      const prev = prevByCat.get(key) || 0
      const growthPct = prev > 0 ? Math.round(((c.amount - prev) / prev) * 100) : c.amount > 0 ? 100 : 0
      return { ...c, previousAmount: round2(prev), growthPct }
    })
    .filter((c) => c.growthPct !== 0)
    .sort((a, b) => Math.abs(b.growthPct) - Math.abs(a.growthPct))

  const activeSubs = subscriptions.filter((s) => s.status === 'active')
  const subsNow = activeSubs.reduce((s, sub) => s + subscriptionMonthly(sub.amount, sub.cycle), 0)
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const subsThen = subscriptions
    .filter((s) => s.createdAt <= cutoff && s.status === 'active')
    .reduce((s, sub) => s + subscriptionMonthly(sub.amount, sub.cycle), 0)
  // Approximate creep: current monthly vs those that existed 90d ago (still active)
  const subCreepPct =
    subsThen > 0 ? Math.round(((subsNow - subsThen) / subsThen) * 100) : subsNow > 0 ? 100 : 0

  const nets = historyNets
  const mean = nets.length ? nets.reduce((s, n) => s + n, 0) / nets.length : 0
  const variance =
    nets.length > 1 ? nets.reduce((s, n) => s + (n - mean) ** 2, 0) / nets.length : 0
  const stdev = Math.sqrt(variance)

  const detected = [
    {
      key: 'top_spend',
      summary:
        topCategories[0]
          ? `${topCategories[0].name} is ${topCategories[0].sharePct}% of spend this month`
          : 'Not enough expense data yet',
      payload: { topCategories, topMerchants, totalSpend: round2(totalSpend) },
    },
    {
      key: 'weekend_lift',
      summary:
        expenses.length < 4
          ? 'Need more expenses to measure weekend vs weekday spend'
          : `Weekend spend averages ${weekend.liftPct >= 0 ? '+' : ''}${weekend.liftPct}% vs weekdays`,
      payload: weekend,
    },
    {
      key: 'post_payday_lift',
      summary: payday.payday
        ? `Spend +0–5 days after payday (${payday.payday}) is ${payday.liftPct >= 0 ? '+' : ''}${payday.liftPct}% vs other days`
        : 'No income this month to anchor payday',
      payload: payday,
    },
    {
      key: 'category_mom',
      summary:
        momGrowth[0]
          ? `${momGrowth[0].name} changed ${momGrowth[0].growthPct >= 0 ? '+' : ''}${momGrowth[0].growthPct}% vs last month`
          : 'No notable category month-over-month changes',
      payload: { items: momGrowth.slice(0, 5) },
    },
    {
      key: 'subscription_creep',
      summary: `Active subscriptions ≈ ₹${Math.round(subsNow).toLocaleString('en-IN')}/mo (${subCreepPct >= 0 ? '+' : ''}${subCreepPct}% vs longer-lived set)`,
      payload: {
        monthlyNow: round2(subsNow),
        monthlyBaseline: round2(subsThen),
        creepPct: subCreepPct,
        count: activeSubs.length,
      },
    },
    {
      key: 'cashflow_volatility',
      summary:
        nets.length < 3
          ? 'Need a few months of history for cashflow volatility'
          : `Monthly net cashflow stdev ≈ ₹${Math.round(stdev).toLocaleString('en-IN')}`,
      payload: {
        monthlyNets: nets.map(round2),
        mean: round2(mean),
        stdev: round2(stdev),
      },
    },
  ]

  const patterns = []
  for (const p of detected) {
    const row = await db().aiPattern.upsert({
      where: {
        userId_key_period: { userId, key: p.key, period: periodKey },
      },
      create: {
        userId,
        key: p.key,
        period: periodKey,
        payload: JSON.stringify(p.payload),
        summary: p.summary,
      },
      update: {
        payload: JSON.stringify(p.payload),
        summary: p.summary,
      },
    })
    patterns.push({
      id: row.id,
      key: row.key,
      period: row.period,
      summary: row.summary,
      payload: p.payload,
      createdAt: row.createdAt.toISOString(),
    })
  }

  return { period: periodKey, patterns }
}

export async function listPatterns(userId, period) {
  const periodKey = period || monthKey()
  const rows = await db().aiPattern.findMany({
    where: { userId, period: periodKey },
    orderBy: { key: 'asc' },
  })
  if (!rows.length) {
    return detectAndStorePatterns(userId, { period: periodKey })
  }
  return {
    period: periodKey,
    patterns: rows.map((r) => ({
      id: r.id,
      key: r.key,
      period: r.period,
      summary: r.summary,
      payload: JSON.parse(r.payload || '{}'),
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
