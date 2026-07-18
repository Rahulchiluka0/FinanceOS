const AI_SUGGESTIONS = [
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

const TIPS = [
  'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
  'Review subscriptions quarterly — unused services add up fast.',
  'Keep 3–6 months of expenses in your emergency fund.',
  'Automate SIPs on salary day to pay yourself first.',
  'Compare insurance premiums annually for better rates.',
  'Use category budgets with 80% alerts to catch overspend early.',
]

export const aiRepository = {
  getSuggestions() {
    return AI_SUGGESTIONS
  },

  getRandomTip() {
    return TIPS[Math.floor(Math.random() * TIPS.length)]
  },
}
