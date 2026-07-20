import { db } from '../../lib/prisma.js'
import { safeJson } from '../../utils/mappers.js'

export const aiRepository = {
  getSuggestions() {
    return [
      {
        id: 1,
        title: 'Trim dining by 10%',
        body: 'Moving ₹1,840 from dining to your emergency fund finishes it ~3 weeks earlier.',
      },
      {
        id: 2,
        title: 'Pause Adobe for 2 months',
        body: 'Yearly Adobe renews soon — pausing unused seats saves ~₹2,800.',
      },
      {
        id: 3,
        title: 'Anomaly: Amazon ₹4,599',
        body: 'This is 2.1× your usual shopping ticket size. Confirm it was intentional.',
      },
    ]
  },

  getRandomTip() {
    const tips = [
      'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
      'Review subscriptions quarterly — unused services add up fast.',
      'Keep 3–6 months of expenses in your emergency fund.',
      'Automate SIPs on salary day to pay yourself first.',
      'Compare insurance premiums annually for better rates.',
      'Use category budgets with 80% alerts to catch overspend early.',
    ]
    return tips[Math.floor(Math.random() * tips.length)]
  },

  async listActiveInsights(userId, limit = 3) {
    const rows = await db().aiInsight.findMany({
      where: { userId, status: 'active' },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      title: r.title,
      body: r.body,
      fact: safeJson(r.fact, {}),
      action: safeJson(r.action, {}),
      evidence: safeJson(r.evidence, []),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  },
}
