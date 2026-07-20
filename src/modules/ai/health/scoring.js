/** Deterministic Financial Health Score v2 (AI_DESIGN §6.6). */

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function lerpScore(value, stops) {
  // stops: [[input, score], ...] ascending by input
  if (!stops.length) return 0
  if (value <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [x0, y0] = stops[i - 1]
    const [x1, y1] = stops[i]
    if (value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return stops[stops.length - 1][1]
}

export const HEALTH_WEIGHTS = {
  savingsRate: 0.2,
  emergencyFund: 0.15,
  debtBurden: 0.15,
  investmentRatio: 0.1,
  budgetDiscipline: 0.15,
  cashflowStability: 0.1,
  goalProgress: 0.1,
  incomeStability: 0.05,
}

/**
 * @param {object} m metrics from twin builder
 * @returns {{ overall: number, factors: Record<string, object> }}
 */
export function scoreHealth(m) {
  const {
    savingsRatePct = 0,
    liquidBalance = 0,
    monthlyExpense = 0,
    monthlyIncome = 0,
    emiMonthly = 0,
    totalDebt = 0,
    invested = 0,
    netWorth = 0,
    budgets = { onTrack: 0, atRisk: 0, over: 0 },
    monthlyNets = [],
    goalCompletionPctAvg = 0,
    incomeMonthsPresent = 0,
    incomeMonthsWindow = 6,
  } = m

  const emergencyMonths =
    monthlyExpense > 0 ? liquidBalance / monthlyExpense : liquidBalance > 0 ? 6 : 0
  const debtToIncome = monthlyIncome > 0 ? emiMonthly / monthlyIncome : emiMonthly > 0 ? 1 : 0
  const investmentRatio =
    netWorth > 0 ? Math.max(0, invested / netWorth) : invested > 0 ? 0.15 : 0

  const budgetTotal = budgets.onTrack + budgets.atRisk + budgets.over
  const budgetOkPct =
    budgetTotal === 0 ? 70 : ((budgets.onTrack + budgets.atRisk * 0.4) / budgetTotal) * 100

  let cashflowStabilityScore = 55
  if (monthlyNets.length >= 3) {
    const mean = monthlyNets.reduce((s, n) => s + n, 0) / monthlyNets.length
    const variance =
      monthlyNets.reduce((s, n) => s + (n - mean) ** 2, 0) / monthlyNets.length
    const stdev = Math.sqrt(variance)
    const scale = Math.max(Math.abs(mean), monthlyExpense || 1)
    const cv = stdev / scale
    cashflowStabilityScore = lerpScore(cv, [
      [0, 100],
      [0.2, 80],
      [0.5, 50],
      [1, 20],
      [2, 0],
    ])
  }

  const incomeStabilityScore =
    incomeMonthsWindow > 0
      ? (incomeMonthsPresent / incomeMonthsWindow) * 100
      : 0

  const factors = {
    savingsRate: {
      weight: HEALTH_WEIGHTS.savingsRate,
      score: clamp(
        lerpScore(savingsRatePct, [
          [-20, 0],
          [0, 25],
          [10, 45],
          [20, 70],
          [30, 90],
          [50, 100],
        ]),
      ),
      why:
        monthlyIncome <= 0
          ? 'Add income this month to measure your savings rate.'
          : `Savings rate is ${Math.round(savingsRatePct)}% of income this month.`,
      cta:
        savingsRatePct < 20
          ? { label: 'Review expenses', href: '/transactions' }
          : { label: 'Boost a goal', href: '/goals' },
    },
    emergencyFund: {
      weight: HEALTH_WEIGHTS.emergencyFund,
      score: clamp(
        lerpScore(emergencyMonths, [
          [0, 5],
          [1, 35],
          [3, 70],
          [6, 100],
        ]),
      ),
      why: `Liquid runway ≈ ${emergencyMonths.toFixed(1)} months of expenses.`,
      cta:
        emergencyMonths < 3
          ? {
              label: `Add ₹${Math.round(Math.max(0, monthlyExpense * 3 - liquidBalance)).toLocaleString('en-IN')} to emergency`,
              href: '/goals',
            }
          : { label: 'View goals', href: '/goals' },
    },
    debtBurden: {
      weight: HEALTH_WEIGHTS.debtBurden,
      score: clamp(
        lerpScore(debtToIncome, [
          [0, 100],
          [0.1, 85],
          [0.2, 65],
          [0.35, 40],
          [0.5, 15],
          [0.7, 0],
        ]),
      ),
      why:
        totalDebt <= 0
          ? 'No outstanding loan balances tracked.'
          : `EMI is ${Math.round(debtToIncome * 100)}% of monthly income; debt ₹${Math.round(totalDebt).toLocaleString('en-IN')}.`,
      cta: totalDebt > 0 ? { label: 'Review loans', href: '/loans' } : { label: 'Stay debt-light', href: '/loans' },
    },
    investmentRatio: {
      weight: HEALTH_WEIGHTS.investmentRatio,
      score: clamp(
        lerpScore(investmentRatio * 100, [
          [0, 25],
          [5, 45],
          [15, 70],
          [30, 90],
          [50, 100],
        ]),
      ),
      why: `Investments are ${Math.round(investmentRatio * 100)}% of net worth.`,
      cta: { label: 'View investments', href: '/investments' },
    },
    budgetDiscipline: {
      weight: HEALTH_WEIGHTS.budgetDiscipline,
      score: clamp(budgetOkPct),
      why:
        budgetTotal === 0
          ? 'No budgets yet — add category budgets to improve this factor.'
          : `${budgets.onTrack} on track, ${budgets.atRisk} at risk, ${budgets.over} over.`,
      cta: { label: 'Open budgets', href: '/budgets' },
    },
    cashflowStability: {
      weight: HEALTH_WEIGHTS.cashflowStability,
      score: clamp(cashflowStabilityScore),
      why:
        monthlyNets.length < 3
          ? 'Need a few months of history to score cashflow stability.'
          : 'Based on variance of net cashflow over recent months.',
      cta: { label: 'See cashflow', href: '/reports' },
    },
    goalProgress: {
      weight: HEALTH_WEIGHTS.goalProgress,
      score: clamp(goalCompletionPctAvg || (m.hasGoals === false ? 40 : 0)),
      why:
        m.hasGoals === false
          ? 'No active goals — creating one lifts this factor.'
          : `Active goals average ${Math.round(goalCompletionPctAvg)}% complete.`,
      cta: { label: 'View goals', href: '/goals' },
    },
    incomeStability: {
      weight: HEALTH_WEIGHTS.incomeStability,
      score: clamp(incomeStabilityScore),
      why: `Income recorded in ${incomeMonthsPresent}/${incomeMonthsWindow} recent months.`,
      cta: { label: 'Log income', href: '/transactions' },
    },
  }

  let overall = 0
  for (const f of Object.values(factors)) {
    overall += f.score * f.weight
  }
  overall = clamp(overall)

  return { overall, factors }
}

export function riskFromProfile({ overall, runwayMonths, budgetsOver, debtToIncome }) {
  const reasons = []
  let level = 'low'

  if (runwayMonths < 1) {
    reasons.push('Runway under 1 month')
    level = 'high'
  } else if (runwayMonths < 2) {
    reasons.push('Runway under 2 months')
    level = level === 'high' ? 'high' : 'medium'
  }

  if (budgetsOver > 0) {
    reasons.push(`${budgetsOver} budget(s) over limit`)
    if (budgetsOver >= 2) level = 'high'
    else if (level === 'low') level = 'medium'
  }

  if (debtToIncome > 0.4) {
    reasons.push('High EMI-to-income ratio')
    level = 'high'
  }

  if (overall < 40) {
    reasons.push('Health score below 40')
    level = 'high'
  } else if (overall < 55 && level === 'low') {
    reasons.push('Health score needs attention')
    level = 'medium'
  }

  if (!reasons.length) reasons.push('No major risk signals')

  return { level, reasons }
}
