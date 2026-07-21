import { db } from '../../../lib/prisma.js'
import { getOrBuildTwin } from '../twin/builder.js'

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

/** EMI for principal P, annual rate %, tenure months */
export function calcEmi(principal, annualRate, tenureMonths) {
  const P = Number(principal) || 0
  const n = Math.max(1, Number(tenureMonths) || 1)
  const r = (Number(annualRate) || 0) / 100 / 12
  if (P <= 0) return 0
  if (r <= 0) return round2(P / n)
  const factor = Math.pow(1 + r, n)
  return round2((P * r * factor) / (factor - 1))
}

export const SIM_TEMPLATES = [
  {
    id: 'buy_car',
    label: 'Buy car / vehicle',
    description: 'Down payment + EMI + running costs vs baseline',
    fields: [
      { key: 'price', label: 'Price', type: 'number', default: 800000 },
      { key: 'downPayment', label: 'Down payment', type: 'number', default: 200000 },
      { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', default: 60 },
      { key: 'annualRate', label: 'Interest % p.a.', type: 'number', default: 9.5 },
      { key: 'runningMonthly', label: 'Fuel/insurance / mo', type: 'number', default: 5000 },
    ],
  },
  {
    id: 'buy_house',
    label: 'Buy house',
    description: 'Mortgage EMI; optional rent offset',
    fields: [
      { key: 'price', label: 'Price', type: 'number', default: 5000000 },
      { key: 'downPayment', label: 'Down payment', type: 'number', default: 1000000 },
      { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', default: 240 },
      { key: 'annualRate', label: 'Interest % p.a.', type: 'number', default: 8.5 },
      { key: 'rentReplaced', label: 'Rent replaced / mo', type: 'number', default: 25000 },
    ],
  },
  {
    id: 'salary_change',
    label: 'Salary change',
    description: 'New monthly income projection',
    fields: [{ key: 'newIncome', label: 'New monthly income', type: 'number', default: 100000 }],
  },
  {
    id: 'new_loan',
    label: 'New loan',
    description: 'Add EMI / principal to cashflow',
    fields: [
      { key: 'principal', label: 'Principal', type: 'number', default: 300000 },
      { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', default: 36 },
      { key: 'annualRate', label: 'Interest % p.a.', type: 'number', default: 12 },
    ],
  },
  {
    id: 'vacation',
    label: 'Vacation',
    description: 'One-time spend from liquid',
    fields: [{ key: 'amount', label: 'Trip cost', type: 'number', default: 80000 }],
  },
  {
    id: 'increase_sip',
    label: 'Increase SIP',
    description: 'Monthly investment bump',
    fields: [{ key: 'sipBump', label: 'Extra SIP / mo', type: 'number', default: 5000 }],
  },
  {
    id: 'emergency_push',
    label: 'Emergency fund push',
    description: 'Allocate surplus to emergency buffer',
    fields: [{ key: 'monthlyAllocation', label: 'Monthly allocation', type: 'number', default: 10000 }],
  },
]

function cloneTwin(profile) {
  return JSON.parse(JSON.stringify(profile))
}

function projectSeries(startLiquid, monthlyNet, horizon, oneTimeOut = 0) {
  const cashflow = []
  const netWorth = []
  let liquid = startLiquid - oneTimeOut
  for (let m = 1; m <= horizon; m++) {
    liquid = round2(liquid + monthlyNet)
    cashflow.push({ month: m, net: monthlyNet, liquid })
    netWorth.push({ month: m, netWorth: liquid })
  }
  return { cashflow, netWorth, endLiquid: liquid }
}

function applyScenario(baseline, template, params) {
  const twin = cloneTwin(baseline)
  const income = twin.cash.monthlyIncome || 0
  const expense = twin.cash.monthlyExpense || 0
  const emi = twin.debt.emiMonthly || 0
  const liquid = twin.cash.liquidBalance || 0
  let monthlyDelta = 0
  let oneTimeOut = 0
  let notes = []

  switch (template) {
    case 'buy_car': {
      const price = Number(params.price) || 0
      const down = Math.min(price, Number(params.downPayment) || 0)
      const loan = Math.max(0, price - down)
      const carEmi = calcEmi(loan, params.annualRate, params.tenureMonths)
      const running = Number(params.runningMonthly) || 0
      oneTimeOut = down
      monthlyDelta = -(carEmi + running)
      notes.push(`Loan ₹${Math.round(loan).toLocaleString('en-IN')} → EMI ₹${carEmi}/mo`)
      twin.debt.emiMonthly = round2(emi + carEmi)
      twin.debt.totalDebt = round2((twin.debt.totalDebt || 0) + loan)
      break
    }
    case 'buy_house': {
      const price = Number(params.price) || 0
      const down = Math.min(price, Number(params.downPayment) || 0)
      const loan = Math.max(0, price - down)
      const houseEmi = calcEmi(loan, params.annualRate, params.tenureMonths)
      const rent = Number(params.rentReplaced) || 0
      oneTimeOut = down
      monthlyDelta = -(houseEmi - rent)
      notes.push(`Mortgage EMI ₹${houseEmi}/mo; rent offset ₹${rent}/mo`)
      twin.debt.emiMonthly = round2(emi + houseEmi)
      twin.debt.totalDebt = round2((twin.debt.totalDebt || 0) + loan)
      break
    }
    case 'salary_change': {
      const neu = Number(params.newIncome) || income
      monthlyDelta = neu - income
      twin.cash.monthlyIncome = neu
      notes.push(`Income ${income} → ${neu}`)
      break
    }
    case 'new_loan': {
      const principal = Number(params.principal) || 0
      const loanEmi = calcEmi(principal, params.annualRate, params.tenureMonths)
      monthlyDelta = -loanEmi
      twin.debt.emiMonthly = round2(emi + loanEmi)
      twin.debt.totalDebt = round2((twin.debt.totalDebt || 0) + principal)
      notes.push(`New EMI ₹${loanEmi}/mo`)
      break
    }
    case 'vacation': {
      oneTimeOut = Number(params.amount) || 0
      notes.push(`One-time spend ₹${Math.round(oneTimeOut).toLocaleString('en-IN')}`)
      break
    }
    case 'increase_sip': {
      const bump = Number(params.sipBump) || 0
      monthlyDelta = -bump
      notes.push(`Extra SIP ₹${bump}/mo (invested, not consumed)`)
      break
    }
    case 'emergency_push': {
      const alloc = Number(params.monthlyAllocation) || 0
      monthlyDelta = -alloc
      notes.push(`Park ₹${alloc}/mo into emergency buffer`)
      break
    }
    default:
      throw Object.assign(new Error(`Unknown template: ${template}`), { status: 400 })
  }

  const baseNet = income - expense - emi
  const scenarioNet = round2(baseNet + monthlyDelta)
  twin.cash.monthlyExpense = expense
  twin.cash.netCashflow = scenarioNet
  twin.cash.liquidBalance = round2(Math.max(0, liquid - oneTimeOut))

  return { twin, monthlyDelta, oneTimeOut, baseNet, scenarioNet, notes }
}

/**
 * Approximate health impact vs doing nothing over the same horizon.
 * Never compare projected end-cash to today's balance — that always looks “better”
 * after a few months of surplus, even if you spent on a trip.
 */
function healthDeltaApprox(baseline, {
  baselineEndLiquid,
  scenarioEndLiquid,
  baseNet,
  scenarioNet,
  oneTimeOut = 0,
}) {
  const baseOverall = baseline.health?.overall ?? 50
  const liquid = baseline.cash?.liquidBalance || 0
  let delta = 0

  const endGap = scenarioEndLiquid - baselineEndLiquid
  if (endGap < -1) {
    delta -= endGap < -(baselineEndLiquid || 0) * 0.25 ? 6 : 3
  } else if (endGap > 1) {
    delta += endGap > (baselineEndLiquid || 0) * 0.1 ? 4 : 2
  }

  if (scenarioNet < 0) delta -= 8
  else if (baseNet > 0 && scenarioNet < baseNet * 0.5) delta -= 4
  else if (scenarioNet > baseNet + 1) delta += 3
  else if (scenarioNet < baseNet - 1) delta -= 2

  if (oneTimeOut > 0) {
    if (oneTimeOut > liquid) delta -= 10
    else if (liquid > 0 && oneTimeOut > liquid * 0.3) delta -= 3
    else delta -= 1
  }

  return {
    baseline: baseOverall,
    scenario: Math.max(0, Math.min(100, baseOverall + delta)),
    delta,
  }
}

function recommendationText(template, baseNet, scenarioNet, oneTimeOut, liquid, notes) {
  if (oneTimeOut > liquid) {
    return `Down payment / one-time cost exceeds current liquid (₹${Math.round(liquid).toLocaleString('en-IN')}). Build a buffer or reduce the outlay first.`
  }
  if (scenarioNet < 0) {
    return `This scenario turns monthly cashflow negative (≈ ₹${Math.round(scenarioNet).toLocaleString('en-IN')}/mo). Delay the decision or raise income / cut expenses.`
  }
  if (scenarioNet < baseNet * 0.5 && baseNet > 0) {
    return `Affordable on paper, but surplus shrinks sharply. Keep an emergency cushion before committing.`
  }
  if (template === 'vacation') {
    return `One-time spend looks manageable if liquid stays above 1–2 months of expenses afterward.`
  }
  return `Projection stays cashflow-positive. ${notes[0] || ''} Review EMI stress before you commit — simulation only.`
}

/**
 * Life Simulator — in-memory Twin clone; never mutates ledger.
 */
export async function runSimulation(userId, { template, params = {}, horizonMonths = 36, save = true } = {}) {
  if (!SIM_TEMPLATES.find((t) => t.id === template)) {
    const err = new Error('Unknown simulation template')
    err.status = 400
    throw err
  }

  const horizon = Math.min(60, Math.max(6, Number(horizonMonths) || 36))
  const { profile } = await getOrBuildTwin(userId)
  const applied = applyScenario(profile, template, params)
  const liquid = profile.cash.liquidBalance || 0

  const baselineSeries = projectSeries(liquid, applied.baseNet, horizon, 0)
  const scenarioSeries = projectSeries(liquid, applied.scenarioNet, horizon, applied.oneTimeOut)
  const health = healthDeltaApprox(profile, {
    baselineEndLiquid: baselineSeries.endLiquid,
    scenarioEndLiquid: scenarioSeries.endLiquid,
    baseNet: applied.baseNet,
    scenarioNet: applied.scenarioNet,
    oneTimeOut: applied.oneTimeOut,
  })

  const goalDelayMonths =
    applied.scenarioNet < applied.baseNet && applied.baseNet > 0
      ? Math.min(24, Math.round(((applied.baseNet - applied.scenarioNet) / applied.baseNet) * 12))
      : 0

  const result = {
    disclaimer: 'Simulation only — nothing saved to your ledger.',
    template,
    params,
    horizonMonths: horizon,
    notes: applied.notes,
    recommendation: recommendationText(
      template,
      applied.baseNet,
      applied.scenarioNet,
      applied.oneTimeOut,
      liquid,
      applied.notes,
    ),
    comparison: {
      baselineMonthlyNet: applied.baseNet,
      scenarioMonthlyNet: applied.scenarioNet,
      monthlyDelta: applied.monthlyDelta,
      oneTimeOutflow: applied.oneTimeOut,
      baselineEndLiquid: baselineSeries.endLiquid,
      scenarioEndLiquid: scenarioSeries.endLiquid,
      goalDelayMonths,
    },
    health,
    series: {
      baseline: baselineSeries.cashflow,
      scenario: scenarioSeries.cashflow,
      netWorthBaseline: baselineSeries.netWorth,
      netWorthScenario: scenarioSeries.netWorth,
    },
    asOf: profile.asOf,
  }

  let id = null
  if (save) {
    const row = await db().aiSimulation.create({
      data: {
        userId,
        template,
        params: JSON.stringify(params),
        result: JSON.stringify(result),
      },
    })
    id = row.id
  }

  return { id, ...result }
}

export async function listSimulations(userId, { limit = 10 } = {}) {
  const rows = await db().aiSimulation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(30, Number(limit) || 10),
  })
  return rows.map((r) => ({
    id: r.id,
    template: r.template,
    params: JSON.parse(r.params || '{}'),
    result: JSON.parse(r.result || '{}'),
    createdAt: r.createdAt.toISOString(),
  }))
}

export function listTemplates() {
  return SIM_TEMPLATES
}
