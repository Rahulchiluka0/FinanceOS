import { db } from '../../../lib/prisma.js'
import { getOrBuildTwin } from '../twin/builder.js'
import { goalsService } from '../../goals/service.js'

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function riskFactor(level) {
  const l = String(level || 'low').toLowerCase()
  if (l === 'high') return 0.4
  if (l === 'medium') return 0.55
  return 0.65
}

function etaMonths(target, monthly) {
  if (!monthly || monthly <= 0) return 99
  return Math.max(1, Math.ceil(target / monthly))
}

function deadlineFromMonths(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * Deterministic goal ideas from Twin surplus (design §6.7).
 */
export async function buildGoalRecommendations(userId, { persist = true } = {}) {
  const { profile } = await getOrBuildTwin(userId)
  const income = profile.cash?.monthlyIncome || 0
  const expense = profile.cash?.monthlyExpense || 0
  const emi = profile.debt?.emiMonthly || 0
  const subs = profile.obligations?.subscriptionsMonthly || 0
  const liquid = profile.cash?.liquidBalance || 0
  const debt = profile.debt?.totalDebt || 0
  const riskLevel = profile.risk?.level || 'low'

  const surplus = Math.max(0, income - expense - emi - subs)
  const contribute = round2(surplus * riskFactor(riskLevel))
  const emergencyTarget = round2(expense * 3)
  const emergencyGap = Math.max(0, emergencyTarget - liquid)

  const ideas = []

  if (emergencyGap >= 1000) {
    const monthly = Math.max(contribute, round2(emergencyGap / 12))
    ideas.push({
      templateKey: 'emergency_fund',
      title: 'Build emergency fund (3 months)',
      targetAmount: round2(emergencyGap),
      monthly: round2(Math.min(monthly, Math.max(contribute, 500))),
      etaMonths: etaMonths(emergencyGap, Math.max(contribute, 500)),
      confidence: contribute > 0 ? 78 : 45,
      priority: 1,
      rationale: `Liquid covers ~${profile.buffers?.runwayMonths ?? 0} months of expense. Gap to 3-month cushion is ₹${Math.round(emergencyGap).toLocaleString('en-IN')}.`,
    })
  }

  if (debt >= 5000 && emi > 0) {
    const extra = round2(Math.max(contribute * 0.5, 1000))
    const target = round2(Math.min(debt, extra * 12))
    ideas.push({
      templateKey: 'debt_payoff',
      title: 'Accelerate loan payoff',
      targetAmount: target,
      monthly: extra,
      etaMonths: etaMonths(target, extra),
      confidence: 72,
      priority: 2,
      rationale: `You have ~₹${Math.round(debt).toLocaleString('en-IN')} debt and ₹${Math.round(emi).toLocaleString('en-IN')}/mo EMI. Extra principal can shrink interest.`,
    })
  }

  if (contribute >= 1500) {
    const target = round2(contribute * 6)
    ideas.push({
      templateKey: 'short_vacation',
      title: 'Short trip / experience fund',
      targetAmount: target,
      monthly: round2(contribute * 0.35),
      etaMonths: 6,
      confidence: 70,
      priority: 3,
      rationale: `Estimated safe surplus ~₹${Math.round(contribute).toLocaleString('en-IN')}/mo after expenses, EMI, and subscriptions.`,
    })
  }

  if (contribute >= 2000) {
    const monthly = round2(contribute * 0.4)
    const target = round2(monthly * 24)
    ideas.push({
      templateKey: 'long_sip',
      title: '24-month investment corpus',
      targetAmount: target,
      monthly,
      etaMonths: 24,
      confidence: 68,
      priority: 4,
      rationale: `Allocate part of surplus to a steady investment goal without touching your emergency buffer.`,
    })
  }

  if (!ideas.length) {
    ideas.push({
      templateKey: 'starter_save',
      title: 'Starter savings goal',
      targetAmount: 10000,
      monthly: 1000,
      etaMonths: 10,
      confidence: 40,
      priority: 5,
      rationale:
        surplus <= 0
          ? 'Cashflow is tight this month — start small and revisit after cutting a subscription or budget.'
          : 'A modest first goal builds the saving habit while Twin gathers more history.',
    })
  }

  ideas.sort((a, b) => a.priority - b.priority)

  if (!persist) {
    return {
      surplus: round2(surplus),
      safeContribute: contribute,
      recommendations: ideas.map((i, idx) => ({ id: `ephemeral-${idx}`, status: 'suggested', ...i })),
    }
  }

  await db().aiGoalRecommendation.updateMany({
    where: { userId, status: 'suggested' },
    data: { status: 'dismissed' },
  })

  const created = []
  for (const idea of ideas.slice(0, 5)) {
    const row = await db().aiGoalRecommendation.create({
      data: {
        userId,
        title: idea.title,
        targetAmount: idea.targetAmount,
        monthly: idea.monthly,
        etaMonths: idea.etaMonths,
        confidence: idea.confidence,
        priority: idea.priority,
        rationale: idea.rationale,
        templateKey: idea.templateKey,
        status: 'suggested',
      },
    })
    created.push(mapRec(row))
  }

  return {
    surplus: round2(surplus),
    safeContribute: contribute,
    asOf: profile.asOf,
    recommendations: created,
  }
}

function mapRec(row) {
  return {
    id: row.id,
    title: row.title,
    targetAmount: row.targetAmount,
    monthly: row.monthly,
    etaMonths: row.etaMonths,
    confidence: row.confidence,
    priority: row.priority,
    rationale: row.rationale,
    status: row.status,
    templateKey: row.templateKey,
    deadline: deadlineFromMonths(row.etaMonths),
    prefill: {
      name: row.title,
      targetAmount: row.targetAmount,
      currentAmount: 0,
      deadline: deadlineFromMonths(row.etaMonths),
      color: '#1A56DB',
    },
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
  }
}

export async function listGoalRecommendations(userId, { refresh = false } = {}) {
  if (refresh) return buildGoalRecommendations(userId)

  const rows = await db().aiGoalRecommendation.findMany({
    where: { userId, status: 'suggested' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    take: 10,
  })

  if (!rows.length) return buildGoalRecommendations(userId)

  const { profile } = await getOrBuildTwin(userId)
  const income = profile.cash?.monthlyIncome || 0
  const expense = profile.cash?.monthlyExpense || 0
  const emi = profile.debt?.emiMonthly || 0
  const subs = profile.obligations?.subscriptionsMonthly || 0
  const surplus = Math.max(0, income - expense - emi - subs)

  return {
    surplus: round2(surplus),
    safeContribute: round2(surplus * riskFactor(profile.risk?.level)),
    asOf: profile.asOf,
    recommendations: rows.map(mapRec),
  }
}

export async function dismissGoalRecommendation(userId, id) {
  const row = await db().aiGoalRecommendation.findFirst({ where: { id, userId } })
  if (!row) return null
  return mapRec(
    await db().aiGoalRecommendation.update({
      where: { id },
      data: { status: 'dismissed' },
    }),
  )
}

/**
 * Accept → create real Goal via goals module (user-confirmed ledger write path).
 */
export async function acceptGoalRecommendation(userId, id) {
  const row = await db().aiGoalRecommendation.findFirst({ where: { id, userId } })
  if (!row) return null
  if (row.status === 'accepted') {
    return { recommendation: mapRec(row), goal: null, alreadyAccepted: true }
  }

  const goal = await goalsService.create(userId, {
    name: row.title,
    targetAmount: row.targetAmount,
    currentAmount: 0,
    deadline: deadlineFromMonths(row.etaMonths),
    color: '#1A56DB',
  })

  const updated = await db().aiGoalRecommendation.update({
    where: { id },
    data: { status: 'accepted' },
  })

  return { recommendation: mapRec(updated), goal, alreadyAccepted: false }
}
