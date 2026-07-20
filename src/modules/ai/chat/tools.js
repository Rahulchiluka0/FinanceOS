import { db } from '../../../lib/prisma.js'
import { startOfMonth, endOfMonth } from '../../../utils/mappers.js'
import { spentForCategoryPeriod } from '../../budgets/alerts.js'
import { getOrBuildTwin } from '../twin/builder.js'
import { TOOL_NAMES } from '../../../lib/ai/tools.js'

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function fmtInr(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
}

/** Resolve period string → { from, to, label } */
export function resolvePeriod(period) {
  const now = new Date()
  const p = String(period || 'this_month').toLowerCase().trim()

  if (p === 'last_month' || p === 'previous_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return {
      from: startOfMonth(d),
      to: endOfMonth(d),
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  }

  const ym = p.match(/^(\d{4})-(\d{2})$/)
  if (ym) {
    const y = Number(ym[1])
    const m = Number(ym[2]) - 1
    const d = new Date(y, m, 1)
    return {
      from: startOfMonth(d),
      to: endOfMonth(d),
      label: `${ym[1]}-${ym[2]}`,
    }
  }

  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
    label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  }
}

function subscriptionMonthly(amount, cycle) {
  const c = String(cycle || 'monthly').toLowerCase()
  if (c === 'yearly' || c === 'annual') return amount / 12
  if (c === 'quarterly') return amount / 3
  if (c === 'weekly') return (amount * 52) / 12
  return amount
}

async function findCategoryIdsByName(userId, categoryName) {
  if (!categoryName) return null
  const cats = await db().category.findMany({
    where: {
      userId,
      archived: false,
      name: { contains: String(categoryName), mode: 'insensitive' },
    },
    select: { id: true, name: true },
  })
  return cats
}

const executors = {
  async spend_by_category(userId, args = {}) {
    const { from, to, label } = resolvePeriod(args.period)
    const cats = await findCategoryIdsByName(userId, args.categoryName)
    const where = {
      userId,
      type: 'expense',
      date: { gte: from, lte: to },
      ...(cats?.length ? { categoryId: { in: cats.map((c) => c.id) } } : {}),
    }
    const grouped = await db().transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
    })
    const allCats = await db().category.findMany({
      where: { userId },
      select: { id: true, name: true },
    })
    const byId = Object.fromEntries(allCats.map((c) => [c.id, c.name]))
    const items = grouped
      .map((g) => ({
        categoryId: g.categoryId,
        name: g.categoryId ? byId[g.categoryId] || 'Category' : 'Uncategorized',
        amount: round2(g._sum.amount || 0),
      }))
      .sort((a, b) => b.amount - a.amount)

    const total = items.reduce((s, i) => s + i.amount, 0)
    const facts = [
      {
        key: 'spend_total',
        label: args.categoryName ? `Spend on ${args.categoryName}` : 'Total expense',
        value: fmtInr(total),
        raw: total,
      },
      ...items.slice(0, 8).map((i) => ({
        key: `cat:${i.categoryId || 'none'}`,
        label: i.name,
        value: fmtInr(i.amount),
        raw: i.amount,
      })),
    ]
    return {
      facts,
      citations: [{ period: label, filters: args.categoryName || 'all categories' }],
      data: { total, items, period: label },
    }
  },

  async spend_by_merchant(userId, args = {}) {
    const { from, to, label } = resolvePeriod(args.period)
    const limit = Math.min(20, Math.max(1, Number(args.limit) || 8))
    const rows = await db().transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: { gte: from, lte: to },
        ...(args.query
          ? { title: { contains: String(args.query), mode: 'insensitive' } }
          : {}),
      },
      select: { title: true, amount: true },
    })
    const map = new Map()
    for (const t of rows) {
      const key = String(t.title || 'Unknown').trim() || 'Unknown'
      const prev = map.get(key) || { title: key, amount: 0, count: 0 }
      prev.amount += t.amount
      prev.count += 1
      map.set(key, prev)
    }
    const items = [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
    const facts = items.map((i) => ({
      key: `merchant:${i.title}`,
      label: i.title,
      value: `${fmtInr(i.amount)} (${i.count} tx)`,
      raw: round2(i.amount),
    }))
    return {
      facts,
      citations: [{ period: label, filters: args.query || 'all titles' }],
      data: { items, period: label },
    }
  },

  async cashflow_period(userId, args = {}) {
    const { from, to, label } = resolvePeriod(args.period)
    const [incomeAgg, expenseAgg] = await Promise.all([
      db().transaction.aggregate({
        where: { userId, type: 'income', date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      db().transaction.aggregate({
        where: { userId, type: 'expense', date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ])
    const income = round2(incomeAgg._sum.amount || 0)
    const expense = round2(expenseAgg._sum.amount || 0)
    const net = round2(income - expense)
    const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0
    return {
      facts: [
        { key: 'income', label: 'Income', value: fmtInr(income), raw: income },
        { key: 'expense', label: 'Expense', value: fmtInr(expense), raw: expense },
        { key: 'net', label: 'Net cashflow', value: fmtInr(net), raw: net },
        { key: 'savings_rate', label: 'Savings rate', value: `${savingsRate}%`, raw: savingsRate },
      ],
      citations: [{ period: label, filters: 'cashflow' }],
      data: { income, expense, net, savingsRate, period: label },
    }
  },

  async list_transactions(userId, args = {}) {
    const { from, to, label } = resolvePeriod(args.period)
    const limit = Math.min(25, Math.max(1, Number(args.limit) || 10))
    const cats = await findCategoryIdsByName(userId, args.categoryName)
    const type = args.type && args.type !== 'all' ? String(args.type) : undefined
    const rows = await db().transaction.findMany({
      where: {
        userId,
        date: { gte: from, lte: to },
        ...(type ? { type } : {}),
        ...(cats?.length ? { categoryId: { in: cats.map((c) => c.id) } } : {}),
        ...(args.query
          ? {
              OR: [
                { title: { contains: String(args.query), mode: 'insensitive' } },
                { notes: { contains: String(args.query), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: { category: true },
    })
    const facts = rows.map((t) => ({
      key: `tx:${t.id}`,
      label: `${t.date.toISOString().slice(0, 10)} · ${t.title}`,
      value: `${t.type === 'income' ? '+' : '-'}${fmtInr(t.amount)}${t.category ? ` · ${t.category.name}` : ''}`,
      raw: t.amount,
    }))
    return {
      facts,
      citations: [{ period: label, filters: [type, args.categoryName, args.query].filter(Boolean).join(', ') || 'all' }],
      data: { count: rows.length, period: label },
    }
  },

  async budget_status(userId, args = {}) {
    const budgets = await db().budget.findMany({
      where: { userId },
      include: { category: true },
    })
    const filtered = args.categoryName
      ? budgets.filter((b) =>
          b.category.name.toLowerCase().includes(String(args.categoryName).toLowerCase()),
        )
      : budgets

    const items = []
    for (const b of filtered) {
      const spent = await spentForCategoryPeriod(userId, b.categoryId, b.period)
      const pct = b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : 0
      items.push({
        id: b.id,
        category: b.category.name,
        limit: b.limitAmount,
        spent,
        pct,
        status: pct >= 100 ? 'over' : pct >= (b.alertAt || 80) ? 'atRisk' : 'onTrack',
      })
    }
    const facts = items.map((i) => ({
      key: `budget:${i.id}`,
      label: i.category,
      value: `${fmtInr(i.spent)} / ${fmtInr(i.limit)} (${i.pct}% · ${i.status})`,
      raw: i.pct,
    }))
    if (!facts.length) {
      facts.push({ key: 'budget_empty', label: 'Budgets', value: 'No budgets match', raw: 0 })
    }
    return {
      facts,
      citations: [{ period: 'current budget period', filters: args.categoryName || 'all' }],
      data: { items },
    }
  },

  async goal_status(userId, args = {}) {
    const goals = await db().goal.findMany({
      where: {
        userId,
        ...(args.includeCompleted ? {} : { completed: false }),
      },
      orderBy: { createdAt: 'asc' },
    })
    const facts = goals.map((g) => {
      const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0
      return {
        key: `goal:${g.id}`,
        label: g.name,
        value: `${fmtInr(g.currentAmount)} / ${fmtInr(g.targetAmount)} (${pct}%)`,
        raw: pct,
      }
    })
    if (!facts.length) {
      facts.push({ key: 'goals_empty', label: 'Goals', value: 'No active goals', raw: 0 })
    }
    return { facts, citations: [{ period: 'all', filters: 'goals' }], data: { count: goals.length } }
  },

  async subscription_costs(userId) {
    const subs = await db().subscription.findMany({
      where: { userId, status: 'active' },
    })
    const monthly = round2(
      subs.reduce((s, sub) => s + subscriptionMonthly(sub.amount, sub.cycle), 0),
    )
    const facts = [
      { key: 'subs_monthly', label: 'Subscriptions / month', value: fmtInr(monthly), raw: monthly },
      ...subs.map((s) => ({
        key: `sub:${s.id}`,
        label: s.name,
        value: `${fmtInr(s.amount)} / ${s.cycle}`,
        raw: s.amount,
      })),
    ]
    return {
      facts,
      citations: [{ period: 'active', filters: 'subscriptions' }],
      data: { monthly, count: subs.length },
    }
  },

  async net_worth(userId) {
    const [accounts, investments, loans] = await Promise.all([
      db().account.findMany({ where: { userId, archived: false } }),
      db().investment.findMany({ where: { userId } }),
      db().loan.findMany({ where: { userId } }),
    ])
    const balances = round2(accounts.reduce((s, a) => s + a.balance, 0))
    const invested = round2(investments.reduce((s, i) => s + i.currentValue, 0))
    const debt = round2(loans.reduce((s, l) => s + l.remaining, 0))
    const netWorth = round2(balances + invested - debt)
    return {
      facts: [
        { key: 'balances', label: 'Account balances', value: fmtInr(balances), raw: balances },
        { key: 'invested', label: 'Investments', value: fmtInr(invested), raw: invested },
        { key: 'debt', label: 'Loans remaining', value: fmtInr(debt), raw: debt },
        { key: 'net_worth', label: 'Net worth', value: fmtInr(netWorth), raw: netWorth },
      ],
      citations: [{ period: 'as of now', filters: 'net_worth' }],
      data: { balances, invested, debt, netWorth },
    }
  },

  async twin_summary(userId) {
    const { profile } = await getOrBuildTwin(userId)
    return {
      facts: [
        {
          key: 'health',
          label: 'Health score',
          value: `${profile.health.overall}/100`,
          raw: profile.health.overall,
        },
        {
          key: 'savings_rate',
          label: 'Savings rate',
          value: `${profile.cash.savingsRate}%`,
          raw: profile.cash.savingsRate,
        },
        {
          key: 'runway',
          label: 'Runway',
          value: `${profile.buffers.runwayMonths} mo`,
          raw: profile.buffers.runwayMonths,
        },
        {
          key: 'balance',
          label: 'Total balance',
          value: fmtInr(profile.cash.totalBalance),
          raw: profile.cash.totalBalance,
        },
        {
          key: 'risk',
          label: 'Risk',
          value: profile.risk.level,
          raw: profile.risk.level,
        },
      ],
      citations: [{ period: profile.period?.month, filters: 'twin' }],
      data: { asOf: profile.asOf },
    }
  },
}

/**
 * Execute an allowlisted tool. Unknown names are rejected.
 */
export async function executeTool(userId, name, args = {}) {
  if (!TOOL_NAMES.includes(name)) {
    return {
      facts: [],
      citations: [],
      data: { error: `Tool not allowed: ${name}` },
    }
  }
  const fn = executors[name]
  return fn(userId, args || {})
}

/** Keyword fallback when Gemini is off or returns no tool calls. */
export function inferToolsFromMessage(message) {
  const text = String(message || '').toLowerCase()
  const period = text.includes('last month') || text.includes('previous month')
    ? 'last_month'
    : 'this_month'
  const calls = []

  if (/budget/.test(text)) calls.push({ name: 'budget_status', args: {} })
  if (/goal|emergency fund/.test(text)) calls.push({ name: 'goal_status', args: {} })
  if (/subscription|netflix|spotify/.test(text)) calls.push({ name: 'subscription_costs', args: {} })
  if (/net worth|networth|worth/.test(text)) calls.push({ name: 'net_worth', args: {} })
  if (/runway|health|twin|saving rate|savings rate/.test(text)) {
    calls.push({ name: 'twin_summary', args: {} })
  }
  if (/cashflow|income|expense|save|saving/.test(text) && !calls.some((c) => c.name === 'cashflow_period')) {
    calls.push({ name: 'cashflow_period', args: { period } })
  }
  if (/biggest|largest|recent|transaction|list/.test(text)) {
    calls.push({ name: 'list_transactions', args: { period, type: 'expense', limit: 5 } })
  }
  if (/merchant|amazon|swiggy|zomato|title/.test(text)) {
    calls.push({ name: 'spend_by_merchant', args: { period, limit: 5 } })
  }

  const catMatch = text.match(
    /(?:on|for|in)\s+([a-z][a-z\s]{1,30}?)(?:\s+last|\s+this|\s+month|\?|$)/i,
  )
  if (/spend|spent|spending|category|food|grocery|groceries|dining|bills|rent/.test(text)) {
    let categoryName
    if (/food|dining|restaurant/.test(text)) categoryName = 'food'
    else if (/groc/.test(text)) categoryName = 'groc'
    else if (catMatch) categoryName = catMatch[1].trim()
    calls.push({
      name: 'spend_by_category',
      args: { period, ...(categoryName ? { categoryName } : {}) },
    })
  }

  if (!calls.length) {
    calls.push({ name: 'twin_summary', args: {} })
    calls.push({ name: 'cashflow_period', args: { period } })
  }

  // de-dupe by name
  const seen = new Set()
  return calls.filter((c) => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}
