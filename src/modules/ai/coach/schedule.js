import { evaluateCoach } from '../coach/evaluate.js'

/** Fire-and-forget coach pass after ledger events (never blocks finance writes). */
export function scheduleCoachEvaluate(userId, event = 'mutation') {
  if (!userId) return
  setImmediate(() => {
    evaluateCoach(userId, { event }).catch((err) => {
      console.error('[ai-coach]', err?.message || err)
    })
  })
}
