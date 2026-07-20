import { db } from '../../../lib/prisma.js'
import { safeJson } from '../../../utils/mappers.js'
import { getOrBuildTwin } from '../twin/builder.js'
import { detectAndStorePatterns } from '../patterns/detectors.js'

const HIGH_CAP = 3
const DEDUPE_DAYS = 7
const NOTIFY_HOURS = 48

function fmt(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
}

async function coachNotifyAllowed(userId) {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  })
  const prefs = safeJson(user?.notificationPrefs, {})
  if (prefs.aiCoach === false) return false
  return true
}

async function notifyCoachOnce(userId, insight) {
  if (!(await coachNotifyAllowed(userId))) return false
  if (insight.severity === 'low') return false

  const since = new Date(Date.now() - NOTIFY_HOURS * 60 * 60 * 1000)
  const recent = await db().notification.findMany({
    where: { userId, type: 'ai_coach', createdAt: { gte: since } },
    select: { meta: true, title: true },
  })
  const already = recent.some((n) => {
    try {
      const m = typeof n.meta === 'string' ? JSON.parse(n.meta || '{}') : n.meta || {}
      return m.insightKey === insight.fact?.key || n.title === insight.title
    } catch {
      return n.title === insight.title
    }
  })
  if (already) return false

  await db().notification.create({
    data: {
      userId,
      type: 'ai_coach',
      title: insight.title,
      body: insight.body,
      meta: JSON.stringify({
        insightKey: insight.fact?.key,
        insightId: insight.id || null,
        severity: insight.severity,
        kind: 'coach',
      }),
    },
  })
  return true
}

async function findRecentByKey(userId, key) {
  const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000)
  const rows = await db().aiInsight.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  return rows.find((r) => {
    const fact = safeJson(r.fact, {})
    return fact.key === key
  })
}

async function createInsight(userId, draft) {
  const existing = await findRecentByKey(userId, draft.fact.key)
  if (existing) {
    if (existing.status === 'dismissed' || existing.status === 'acted') return null
    return { ...mapInsight(existing), _existing: true }
  }

  const activeHigh = await db().aiInsight.count({
    where: { userId, status: 'active', severity: 'high' },
  })
  if (draft.severity === 'high' && activeHigh >= HIGH_CAP) {
    draft.severity = 'medium'
  }

  const row = await db().aiInsight.create({
    data: {
      userId,
      type: draft.type,
      severity: draft.severity,
      title: draft.title,
      body: draft.body,
      fact: JSON.stringify(draft.fact || {}),
      action: JSON.stringify(draft.action || {}),
      evidence: JSON.stringify(draft.evidence || []),
      status: 'active',
      expiresAt: draft.expiresAt || null,
    },
  })

  const mapped = mapInsight(row)
  await notifyCoachOnce(userId, mapped)
  return { ...mapped, _existing: false }
}

function mapInsight(r) {
  return {
    id: r.id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    body: r.body,
    fact: safeJson(r.fact, {}),
    action: safeJson(r.action, {}),
    evidence: safeJson(r.evidence, []),
    status: r.status,
    expiresAt: r.expiresAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  }
}

/**
 * Evaluate Twin + patterns and emit coach insights (deterministic).
 */
export async function evaluateCoach(userId, { event = 'digest' } = {}) {
  const { profile } = await getOrBuildTwin(userId)
  const { patterns } = await detectAndStorePatterns(userId)
  const byKey = Object.fromEntries(patterns.map((p) => [p.key, p]))

  const drafts = []

  // Budget overspend
  for (const b of profile.budgets?.items || []) {
    if (b.status === 'over') {
      drafts.push({
        type: 'overspend',
        severity: 'high',
        title: `${b.category} budget exceeded`,
        body: `You've spent ${fmt(b.spent)} of ${fmt(b.limit)} (${b.pct}%). Consider pausing discretionary spend in this category.`,
        fact: {
          key: `budget_over:${b.id}`,
          metric: 'budget_pct',
          value: b.pct,
          baseline: 100,
          spent: b.spent,
          limit: b.limit,
        },
        action: { label: 'Open budgets', href: '/budgets', payload: { budgetId: b.id } },
        evidence: [{ kind: 'budget', id: b.id }],
      })
    } else if (b.status === 'atRisk') {
      drafts.push({
        type: 'overspend',
        severity: 'medium',
        title: `${b.category} nearing budget`,
        body: `You're at ${b.pct}% of your ${fmt(b.limit)} ${b.category} budget. A little headroom left.`,
        fact: {
          key: `budget_risk:${b.id}`,
          metric: 'budget_pct',
          value: b.pct,
          baseline: b.alertAt || 80,
        },
        action: { label: 'Review budget', href: '/budgets', payload: { budgetId: b.id } },
        evidence: [{ kind: 'budget', id: b.id }],
      })
    }
  }

  // Runway / risk
  if ((profile.buffers?.runwayMonths ?? 99) < 1) {
    drafts.push({
      type: 'risk',
      severity: 'high',
      title: 'Runway under 1 month',
      body: `Liquid balance covers less than a month of expenses (${profile.buffers.runwayMonths} mo). Prioritize an emergency buffer.`,
      fact: {
        key: 'runway_low',
        metric: 'runway_months',
        value: profile.buffers.runwayMonths,
        baseline: 3,
      },
      action: { label: 'Start emergency goal', href: '/goals', payload: null },
      evidence: [],
    })
  } else if ((profile.buffers?.runwayMonths ?? 99) < 2) {
    drafts.push({
      type: 'risk',
      severity: 'medium',
      title: 'Thin emergency runway',
      body: `You have about ${profile.buffers.runwayMonths} months of liquid runway. Aim for 3–6 months when you can.`,
      fact: {
        key: 'runway_thin',
        metric: 'runway_months',
        value: profile.buffers.runwayMonths,
        baseline: 3,
      },
      action: { label: 'View goals', href: '/goals', payload: null },
      evidence: [],
    })
  }

  // Bills due
  const bills = profile.obligations?.billsDue7d || []
  if (bills.length > 0) {
    const total = bills.reduce((s, b) => s + b.amount, 0)
    drafts.push({
      type: 'risk',
      severity: bills.length >= 2 ? 'high' : 'medium',
      title: `${bills.length} bill${bills.length > 1 ? 's' : ''} due this week`,
      body: `${fmt(total)} coming due — make sure the linked account has enough float.`,
      fact: {
        key: `bills_due:${bills.map((b) => b.id).sort().join(',')}`,
        metric: 'bills_due_7d',
        value: total,
        count: bills.length,
      },
      action: { label: 'Open bills', href: '/bills', payload: null },
      evidence: bills.map((b) => ({ kind: 'bill', id: b.id })),
    })
  }

  // Goals wins / progress
  for (const g of profile.goals?.active || []) {
    if (g.completionPct >= 100) {
      drafts.push({
        type: 'win',
        severity: 'low',
        title: `${g.name} is funded`,
        body: `Nice work — ${g.name} hit its target of ${fmt(g.target)}.`,
        fact: { key: `goal_done:${g.id}`, metric: 'goal_pct', value: g.completionPct },
        action: { label: 'View goals', href: '/goals', payload: { goalId: g.id } },
        evidence: [{ kind: 'goal', id: g.id }],
      })
    } else if (g.completionPct >= 75) {
      drafts.push({
        type: 'goal',
        severity: 'low',
        title: `${g.name} is ${g.completionPct}% there`,
        body: `You're close — ${fmt(g.target - g.current)} left to finish ${g.name}.`,
        fact: { key: `goal_near:${g.id}`, metric: 'goal_pct', value: g.completionPct },
        action: { label: 'Add to goal', href: '/goals', payload: { goalId: g.id } },
        evidence: [{ kind: 'goal', id: g.id }],
      })
    }
  }

  // Savings win
  if ((profile.cash?.savingsRate ?? 0) >= 30 && (profile.cash?.monthlyIncome ?? 0) > 0) {
    drafts.push({
      type: 'win',
      severity: 'low',
      title: 'Strong savings rate',
      body: `You're saving ${profile.cash.savingsRate}% of income this month — ahead of a common 30% benchmark.`,
      fact: {
        key: `save_win:${profile.period?.month}`,
        metric: 'savings_rate',
        value: profile.cash.savingsRate,
        baseline: 30,
      },
      action: { label: 'Boost a goal', href: '/goals', payload: null },
      evidence: [],
    })
  }

  // Pattern: weekend lift
  const weekend = byKey.weekend_lift?.payload
  if (weekend && weekend.liftPct >= 35 && (profile.cash?.monthlyExpense ?? 0) > 0) {
    drafts.push({
      type: 'opportunity',
      severity: 'medium',
      title: 'Weekend spending runs hotter',
      body: `Weekend purchases average ${weekend.liftPct}% higher than weekdays. A soft weekend cap can free cash for goals.`,
      fact: {
        key: `weekend_lift:${profile.period?.month}`,
        metric: 'weekend_lift_pct',
        value: weekend.liftPct,
        baseline: 0,
      },
      action: { label: 'See transactions', href: '/transactions', payload: null },
      evidence: [],
    })
  }

  // Pattern: post-payday
  const payday = byKey.post_payday_lift?.payload
  if (payday && payday.liftPct >= 40 && payday.payday) {
    drafts.push({
      type: 'opportunity',
      severity: 'low',
      title: 'Post-payday spend spike',
      body: `Spending rises about ${payday.liftPct}% in the 5 days after your largest income. Automating a transfer on payday can help.`,
      fact: {
        key: `payday_lift:${profile.period?.month}`,
        metric: 'post_payday_lift_pct',
        value: payday.liftPct,
      },
      action: { label: 'Set recurring save', href: '/recurring', payload: null },
      evidence: [],
    })
  }

  // Pattern: MoM category growth
  const mom = byKey.category_mom?.payload?.items?.[0]
  if (mom && mom.growthPct >= 40 && mom.amount >= 1000) {
    drafts.push({
      type: 'overspend',
      severity: 'medium',
      title: `${mom.name} up ${mom.growthPct}% MoM`,
      body: `${mom.name} is ${fmt(mom.amount)} this month vs ${fmt(mom.previousAmount)} last month. Worth a quick review.`,
      fact: {
        key: `mom:${mom.categoryId || mom.name}:${profile.period?.month}`,
        metric: 'category_mom_pct',
        value: mom.growthPct,
        amount: mom.amount,
      },
      action: {
        label: 'Filter transactions',
        href: '/transactions',
        payload: { categoryId: mom.categoryId },
      },
      evidence: mom.categoryId ? [{ kind: 'category', id: mom.categoryId }] : [],
    })
  }

  // Subscription creep
  const subs = byKey.subscription_creep?.payload
  if (subs && subs.creepPct >= 20 && subs.monthlyNow > 0) {
    drafts.push({
      type: 'opportunity',
      severity: 'low',
      title: 'Subscriptions creeping up',
      body: `Active subs are about ${fmt(subs.monthlyNow)}/mo (${subs.creepPct >= 0 ? '+' : ''}${subs.creepPct}% vs your longer-lived baseline). Cancel unused ones.`,
      fact: {
        key: `sub_creep:${profile.period?.month}`,
        metric: 'subscription_monthly',
        value: subs.monthlyNow,
        creepPct: subs.creepPct,
      },
      action: { label: 'Review subscriptions', href: '/subscriptions', payload: null },
      evidence: [],
    })
  }

  // Salary-like income allocation tip (event or large income)
  const income = profile.cash?.monthlyIncome || 0
  const expense = profile.cash?.monthlyExpense || 0
  if (income > 0 && income >= expense * 1.5 && event !== 'budget') {
    const surplus = Math.max(0, income - expense - (profile.debt?.emiMonthly || 0))
    if (surplus >= 2000) {
      drafts.push({
        type: 'opportunity',
        severity: 'low',
        title: 'Allocate this month’s surplus',
        body: `After expenses and EMIs, roughly ${fmt(surplus)} looks available. Split across emergency fund and goals.`,
        fact: {
          key: `surplus:${profile.period?.month}`,
          metric: 'surplus',
          value: surplus,
        },
        action: { label: 'Open goals', href: '/goals', payload: null },
        evidence: [],
      })
    }
  }

  // Severity order: high first
  const severityRank = { high: 0, medium: 1, low: 2 }
  drafts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  const created = []
  for (const draft of drafts) {
    const row = await createInsight(userId, draft)
    if (row && !row._existing) created.push(row)
  }

  return {
    event,
    evaluated: drafts.length,
    created: created.length,
    insights: created,
  }
}

export async function listInsights(userId, { status = 'active', type, limit = 50 } = {}) {
  const where = {
    userId,
    ...(status && status !== 'all' ? { status } : {}),
    ...(type && type !== 'all' ? { type } : {}),
  }
  const rows = await db().aiInsight.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: Math.min(100, Number(limit) || 50),
  })
  // severity is string — resort in JS
  const severityRank = { high: 0, medium: 1, low: 2 }
  return rows
    .map(mapInsight)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.createdAt.localeCompare(a.createdAt))
}

export async function dismissInsight(userId, id) {
  const row = await db().aiInsight.findFirst({ where: { id, userId } })
  if (!row) return null
  const updated = await db().aiInsight.update({
    where: { id },
    data: { status: 'dismissed' },
  })
  return mapInsight(updated)
}

export async function actInsight(userId, id) {
  const row = await db().aiInsight.findFirst({ where: { id, userId } })
  if (!row) return null
  const updated = await db().aiInsight.update({
    where: { id },
    data: { status: 'acted' },
  })
  return mapInsight(updated)
}
