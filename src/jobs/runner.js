import { withJobLock } from './lock.js'
import { processDueRecurring } from './tasks/recurring.js'
import { generateNotifications } from './tasks/notifications.js'
import { runAiDigestUnlocked } from './tasks/ai.js'

/** Run all scheduled job tasks under a single advisory lock. */
export async function runAllJobs() {
  const locked = await withJobLock('jobs:all', async () => {
    const recurring = await processDueRecurring()
    const notifications = await generateNotifications()
    const ai = await runAiDigestUnlocked()
    return {
      recurring,
      notifications,
      ai,
      ranAt: new Date().toISOString(),
    }
  })

  if (locked.skipped) {
    return {
      skipped: true,
      reason: locked.reason,
      ranAt: new Date().toISOString(),
    }
  }

  return locked.result
}
