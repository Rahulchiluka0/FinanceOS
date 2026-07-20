import { db } from '../../../lib/prisma.js'
import { startOfMonth, endOfMonth, safeJson } from '../../../utils/mappers.js'
import { spentForCategoryPeriod } from '../../budgets/alerts.js'
import { scoreHealth, riskFromProfile } from '../health/scoring.js'

export const TWIN_VERSION = 1

const LIQUID_TYPES = new Set(['bank', 'cash', 'wallet'])

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function subscriptionMonthly(amount, cycle) {
  const c = String(cycle || 'monthly').toLowerCase()
  if (c === 'yearly' || c === 'annual') return amount / 12
  if (c === 'quarterly') return amount / 3
  if (c === 'weekly') return (amount * 52) / 12
  return amount
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
    .map((x) => ({ title: x.title, amount: Math.round(x.amount * 100) / 100, count: x.count }))
}

async function monthlyNetsForUser(userId, months = 6) {
  const now = new Date()
  const nets = []
  let incomeMonthsPresent = 0

  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(addMonths(now, -i))
    const end = endOfMonth(start)
    const [incomeAgg, expenseAgg] = await Promise.all([
      db().transaction.aggregate({
        where: { userId, type: 'income', date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      db().transaction.aggregate({
        where: { userId, type: 'expense', date: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ])
    const income = incomeAgg._sum.amount || 0
    const expense = expenseAgg._sum.amount || 0
    if (income > 0) incomeMonthsPresent += 1
    nets.push(income - expense)
  }

  return { monthlyNets: nets, incomeMonthsPresent, incomeMonthsWindow: months }
}

function weekendLift(expenses) {
  if (!expenses.length) return 0
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
  const wAvg = wCount ? weekend / wCount : 0
  const dAvg = dCount ? weekday / dCount : 0
  if (dAvg <= 0) return wAvg > 0 ? 100 : 0
  return Math.round(((wAvg - dAvg) / dAvg) * 100)
}

function postPaydayLift(expenses, incomes) {
  if (!incomes.length || !expenses.length) return 0
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
  if (otherAvg <= 0) return nearAvg > 0 ? 100 : 0
  return Math.round(((nearAvg - otherAvg) / otherAvg) * 100)
}

/**
 * Build a Financial Twin profile from ledger data (deterministic).
 */
export async function buildTwinProfile(userId) {
  const now = new Date()
  const from = startOfMonth(now)
  const to = endOfMonth(now)
  const in7 = new Date(now)
  in7.setDate(in7.getDate() + 7)

  const [
    user,
    accounts,
    incomeAgg,
    expenseAgg,
    monthExpenses,
    monthIncomes,
    budgets,
    goals,
    bills,
    subscriptions,
    loans,
    investments,
    categories,
    history,
  ] = await Promise.all([
    db().user.findUnique({ where: { id: userId }, select: { currency: true, timezone: true } }),
    db().account.findMany({ where: { userId, archived: false } }),
    db().transaction.aggregate({
      where: { userId, type: 'income', date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    db().transaction.aggregate({
      where: { userId, type: 'expense', date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    db().transaction.findMany({
      where: { userId, type: 'expense', date: { gte: from, lte: to } },
      select: { title: true, amount: true, date: true, categoryId: true },
    }),
    db().transaction.findMany({
      where: { userId, type: 'income', date: { gte: from, lte: to } },
      select: { title: true, amount: true, date: true },
    }),
    db().budget.findMany({ where: { userId }, include: { category: true } }),
    db().goal.findMany({ where: { userId } }),
    db().bill.findMany({
      where: { userId, status: 'unpaid', dueDate: { lte: in7 } },
      orderBy: { dueDate: 'asc' },
    }),
    db().subscription.findMany({ where: { userId, status: 'active' } }),
    db().loan.findMany({ where: { userId } }),
    db().investment.findMany({ where: { userId } }),
    db().category.findMany({ where: { userId, archived: false }, select: { id: true, name: true } }),
    monthlyNetsForUser(userId, 6),
  ])

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const liquidBalance = accounts
    .filter((a) => LIQUID_TYPES.has(a.type))
    .reduce((s, a) => s + Math.max(0, a.balance), 0)

  const monthlyIncome = incomeAgg._sum.amount || 0
  const monthlyExpense = expenseAgg._sum.amount || 0
  const netCashflow = monthlyIncome - monthlyExpense
  const savingsRate = monthlyIncome > 0 ? (netCashflow / monthlyIncome) * 100 : 0

  const invested = investments.reduce((s, i) => s + i.currentValue, 0)
  const totalDebt = loans.reduce((s, l) => s + l.remaining, 0)
  const emiMonthly = loans.reduce((s, l) => s + l.emi, 0)
  const netWorth = totalBalance + invested - totalDebt
  const investmentRatio = netWorth > 0 ? invested / netWorth : 0
  const debtToIncome = monthlyIncome > 0 ? emiMonthly / monthlyIncome : 0

  const emergencyFundMonths = monthlyExpense > 0 ? liquidBalance / monthlyExpense : 0
  const runwayMonths = emergencyFundMonths

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const catSpend = new Map()
  for (const t of monthExpenses) {
    const id = t.categoryId || '_uncategorized'
    catSpend.set(id, (catSpend.get(id) || 0) + t.amount)
  }
  const topCategories = [...catSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({
      categoryId: id === '_uncategorized' ? null : id,
      name: id === '_uncategorized' ? 'Uncategorized' : catName.get(id) || 'Category',
      amount: Math.round(amount * 100) / 100,
    }))

  const budgetItems = []
  let onTrack = 0
  let atRisk = 0
  let over = 0
  for (const b of budgets) {
    const spent = await spentForCategoryPeriod(userId, b.categoryId, b.period)
    const pct = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0
    let status = 'onTrack'
    if (pct >= 100) {
      status = 'over'
      over += 1
    } else if (pct >= (b.alertAt || 80)) {
      status = 'atRisk'
      atRisk += 1
    } else {
      onTrack += 1
    }
    budgetItems.push({
      id: b.id,
      categoryId: b.categoryId,
      category: b.category?.name,
      limit: b.limitAmount,
      spent,
      pct: Math.round(pct),
      status,
    })
  }

  const activeGoals = goals.filter((g) => !g.completed)
  const goalRows = activeGoals.map((g) => {
    const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0
    return {
      id: g.id,
      name: g.name,
      target: g.targetAmount,
      current: g.currentAmount,
      completionPct: Math.round(pct),
      deadline: g.deadline?.toISOString().slice(0, 10) || null,
    }
  })
  const completionPctAvg = goalRows.length
    ? goalRows.reduce((s, g) => s + g.completionPct, 0) / goalRows.length
    : 0

  const subscriptionsMonthly = subscriptions.reduce(
    (s, sub) => s + subscriptionMonthly(sub.amount, sub.cycle),
    0,
  )

  const health = scoreHealth({
    savingsRatePct: savingsRate,
    liquidBalance,
    monthlyExpense,
    monthlyIncome,
    emiMonthly,
    totalDebt,
    invested,
    netWorth,
    budgets: { onTrack, atRisk, over },
    monthlyNets: history.monthlyNets,
    goalCompletionPctAvg: completionPctAvg,
    incomeMonthsPresent: history.incomeMonthsPresent,
    incomeMonthsWindow: history.incomeMonthsWindow,
    hasGoals: activeGoals.length > 0,
  })

  const risk = riskFromProfile({
    overall: health.overall,
    runwayMonths,
    budgetsOver: over,
    debtToIncome,
  })

  const txDays = monthExpenses.length + monthIncomes.length
  const warmingUp = txDays < 5

  return {
    userId,
    asOf: now.toISOString(),
    version: TWIN_VERSION,
    currency: user?.currency || 'INR',
    timezone: user?.timezone || 'Asia/Kolkata',
    period: {
      month: monthKey(now),
      from: from.toISOString(),
      to: to.toISOString(),
    },
    cash: {
      totalBalance: round2(totalBalance),
      liquidBalance: round2(liquidBalance),
      monthlyIncome: round2(monthlyIncome),
      monthlyExpense: round2(monthlyExpense),
      netCashflow: round2(netCashflow),
      savingsRate: Math.round(savingsRate),
    },
    wealth: {
      netWorth: round2(netWorth),
      invested: round2(invested),
      investmentRatio: Math.round(investmentRatio * 1000) / 1000,
    },
    debt: {
      totalDebt: round2(totalDebt),
      emiMonthly: round2(emiMonthly),
      debtToIncome: Math.round(debtToIncome * 1000) / 1000,
    },
    buffers: {
      emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
      runwayMonths: Math.round(runwayMonths * 10) / 10,
    },
    budgets: { onTrack, atRisk, over, items: budgetItems },
    goals: { active: goalRows, completionPctAvg: Math.round(completionPctAvg) },
    obligations: {
      billsDue7d: bills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: b.amount,
        due: b.dueDate.toISOString().slice(0, 10),
      })),
      subscriptionsMonthly: round2(subscriptionsMonthly),
    },
    behavior: {
      topCategories,
      topMerchants: clusterTitles(monthExpenses),
      weekendSpendLift: weekendLift(monthExpenses),
      postPaydayLift: postPaydayLift(monthExpenses, monthIncomes),
    },
    health: {
      overall: health.overall,
      factors: health.factors,
    },
    risk,
    meta: {
      warmingUp,
      checklist: warmingUp
        ? [
            monthlyIncome <= 0 ? 'Add this month’s salary / income' : null,
            budgets.length === 0 ? 'Create at least one budget' : null,
            activeGoals.length === 0 ? 'Set a savings goal' : null,
            accounts.length === 0 ? 'Add an account' : null,
          ].filter(Boolean)
        : [],
    },
  }
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

export async function ensureAiProfileRow(userId) {
  return db().aiProfile.upsert({
    where: { userId },
    create: { userId, stale: true, profile: '{}', version: TWIN_VERSION },
    update: {},
  })
}

export async function getOrBuildTwin(userId, { force = false } = {}) {
  const row = await ensureAiProfileRow(userId)
  const cached = safeJson(row.profile, null)
  const needsRebuild = force || row.stale || !cached || !cached.cash || cached.version !== TWIN_VERSION

  if (!needsRebuild) {
    return {
      profile: cached,
      stale: false,
      builtAt: row.builtAt?.toISOString() || null,
      fromCache: true,
    }
  }

  const profile = await buildTwinProfile(userId)
  const builtAt = new Date()

  await db().aiProfile.update({
    where: { userId },
    data: {
      profile: JSON.stringify(profile),
      stale: false,
      builtAt,
      version: TWIN_VERSION,
    },
  })

  // Snapshot health when rebuilt (at most one per calendar day)
  const dayStart = new Date(builtAt.getFullYear(), builtAt.getMonth(), builtAt.getDate())
  const existingSnap = await db().aiHealthScore.findFirst({
    where: { userId, asOf: { gte: dayStart } },
    orderBy: { asOf: 'desc' },
  })
  if (!existingSnap) {
    await db().aiHealthScore.create({
      data: {
        userId,
        asOf: builtAt,
        overall: profile.health.overall,
        factors: JSON.stringify(profile.health.factors),
      },
    })
  } else {
    await db().aiHealthScore.update({
      where: { id: existingSnap.id },
      data: {
        asOf: builtAt,
        overall: profile.health.overall,
        factors: JSON.stringify(profile.health.factors),
      },
    })
  }

  return {
    profile,
    stale: false,
    builtAt: builtAt.toISOString(),
    fromCache: false,
  }
}

export async function getHealthHistory(userId, limit = 12) {
  const rows = await db().aiHealthScore.findMany({
    where: { userId },
    orderBy: { asOf: 'desc' },
    take: limit,
  })
  return rows
    .map((r) => ({
      asOf: r.asOf.toISOString(),
      overall: r.overall,
      factors: safeJson(r.factors, {}),
    }))
    .reverse()
}
