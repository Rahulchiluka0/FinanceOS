import { db } from '../../../lib/prisma.js'
import { startOfMonth, endOfMonth } from '../../../utils/mappers.js'
import { aiProvider } from '../../../lib/ai/provider.js'

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function fmtInr(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
}

function resolvePeriod(period, from, to) {
  if (from && to) {
    const f = new Date(from)
    const t = new Date(to)
    const label = `${f.toISOString().slice(0, 10)} → ${t.toISOString().slice(0, 10)}`
    return { from: f, to: t, period: label }
  }
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth()
  const p = String(period || '').trim()
  const ym = p.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    y = Number(ym[1])
    m = Number(ym[2]) - 1
  }
  const d = new Date(y, m, 1)
  return {
    from: startOfMonth(d),
    to: endOfMonth(d),
    period: `${y}-${String(m + 1).padStart(2, '0')}`,
  }
}

function weekKey(date) {
  const d = new Date(date)
  const start = startOfMonth(d)
  const day = d.getDate()
  const week = Math.min(4, Math.floor((day - 1) / 7))
  return `W${week + 1}`
}

function buildOutline(txs, periodLabel) {
  let income = 0
  let expense = 0
  const byCat = new Map()
  const byWeek = new Map()
  let biggest = null
  let bestSaveDay = null
  const dayNet = new Map()

  for (const t of txs) {
    const day = t.date.toISOString().slice(0, 10)
    if (t.type === 'income') {
      income += t.amount
      dayNet.set(day, (dayNet.get(day) || 0) + t.amount)
    } else if (t.type === 'expense') {
      expense += t.amount
      dayNet.set(day, (dayNet.get(day) || 0) - t.amount)
      const cat = t.category?.name || 'Uncategorized'
      byCat.set(cat, (byCat.get(cat) || 0) + t.amount)
      if (!biggest || t.amount > biggest.amount) {
        biggest = { title: t.title, amount: t.amount, date: day, category: cat }
      }
    }
    const wk = weekKey(t.date)
    const bucket = byWeek.get(wk) || { income: 0, expense: 0 }
    if (t.type === 'income') bucket.income += t.amount
    if (t.type === 'expense') bucket.expense += t.amount
    byWeek.set(wk, bucket)
  }

  for (const [day, net] of dayNet) {
    if (!bestSaveDay || net > bestSaveDay.net) bestSaveDay = { day, net }
  }

  const topCategories = [...byCat.entries()]
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const timeline = []
  const incomes = txs
    .filter((t) => t.type === 'income')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
  for (const t of incomes) {
    timeline.push({
      type: 'income',
      date: t.date.toISOString().slice(0, 10),
      title: t.title || 'Income',
      amount: t.amount,
      label: `Income · ${fmtInr(t.amount)}`,
    })
  }
  for (const c of topCategories.slice(0, 3)) {
    timeline.push({
      type: 'category',
      date: periodLabel,
      title: c.name,
      amount: c.amount,
      label: `Spend in ${c.name} · ${fmtInr(c.amount)}`,
    })
  }
  if (biggest) {
    timeline.push({
      type: 'purchase',
      date: biggest.date,
      title: biggest.title,
      amount: biggest.amount,
      label: `Biggest purchase · ${biggest.title} · ${fmtInr(biggest.amount)}`,
    })
  }
  timeline.push({
    type: 'close',
    date: periodLabel,
    title: 'Period net',
    amount: round2(income - expense),
    label: `Net cashflow · ${fmtInr(income - expense)}`,
  })

  const weeks = [...byWeek.entries()].map(([week, v]) => ({
    week,
    income: round2(v.income),
    expense: round2(v.expense),
    net: round2(v.income - v.expense),
  }))

  return {
    stats: {
      period: periodLabel,
      income: round2(income),
      expense: round2(expense),
      net: round2(income - expense),
      txCount: txs.length,
      topCategories,
      biggestPurchase: biggest,
      bestSaveDay,
      weeks,
    },
    timeline,
  }
}

function templateNarrative(stats) {
  const parts = [
    `In ${stats.period} you brought in ${fmtInr(stats.income)} and spent ${fmtInr(stats.expense)}, for a net of ${fmtInr(stats.net)}.`,
  ]
  if (stats.topCategories?.[0]) {
    parts.push(
      `The largest category was ${stats.topCategories[0].name} at ${fmtInr(stats.topCategories[0].amount)}.`,
    )
  }
  if (stats.biggestPurchase) {
    parts.push(
      `Your biggest single purchase was “${stats.biggestPurchase.title}” (${fmtInr(stats.biggestPurchase.amount)}).`,
    )
  }
  if (stats.bestSaveDay && stats.bestSaveDay.net > 0) {
    parts.push(`Strongest cash day: ${stats.bestSaveDay.day} (${fmtInr(stats.bestSaveDay.net)} net).`)
  }
  return parts.join(' ')
}

async function narrateReplay(stats, timeline) {
  const facts = [
    { key: 'income', label: 'Income', value: fmtInr(stats.income) },
    { key: 'expense', label: 'Expense', value: fmtInr(stats.expense) },
    { key: 'net', label: 'Net', value: fmtInr(stats.net) },
    ...(stats.topCategories || []).slice(0, 3).map((c) => ({
      key: `cat:${c.name}`,
      label: c.name,
      value: fmtInr(c.amount),
    })),
  ]
  try {
    if (aiProvider.isLive()) {
      const text = await aiProvider.narrate(
        `Write a short friendly Money Replay paragraph for period ${stats.period}. Use only the facts.`,
        facts,
        [{ period: stats.period, filters: `${stats.txCount} transactions` }],
      )
      if (text) return text
    }
  } catch (err) {
    console.error('[replay] narrate failed', err?.message || err)
  }
  return templateNarrative(stats)
}

/**
 * Money Replay for a calendar month (or custom range).
 */
export async function getMoneyReplay(userId, { period, from, to, force = false } = {}) {
  const resolved = resolvePeriod(period, from, to)
  const cacheKey = resolved.period

  if (!force && !from && !to) {
    const cached = await db().aiMonthlyReplay.findUnique({
      where: { userId_period: { userId, period: cacheKey } },
    })
    if (cached) {
      return {
        period: cached.period,
        summary: cached.summary,
        timeline: JSON.parse(cached.timeline || '[]'),
        stats: JSON.parse(cached.stats || '{}'),
        fromCache: true,
        asOf: cached.createdAt.toISOString(),
      }
    }
  }

  const txs = await db().transaction.findMany({
    where: {
      userId,
      date: { gte: resolved.from, lte: resolved.to },
      type: { in: ['income', 'expense'] },
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  })

  const { stats, timeline } = buildOutline(txs, resolved.period)
  const summary = await narrateReplay(stats, timeline)

  const payload = {
    period: resolved.period,
    summary,
    timeline,
    stats,
    fromCache: false,
    asOf: new Date().toISOString(),
  }

  if (!from && !to && /^\d{4}-\d{2}$/.test(resolved.period)) {
    await db().aiMonthlyReplay.upsert({
      where: { userId_period: { userId, period: resolved.period } },
      create: {
        userId,
        period: resolved.period,
        summary,
        timeline: JSON.stringify(timeline),
        stats: JSON.stringify(stats),
      },
      update: {
        summary,
        timeline: JSON.stringify(timeline),
        stats: JSON.stringify(stats),
      },
    })
  }

  return payload
}
