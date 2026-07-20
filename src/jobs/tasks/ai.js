import { withJobLock } from '../lock.js'
import { db } from '../../lib/prisma.js'
import { getOrBuildTwin } from '../../modules/ai/twin/builder.js'
import { detectAndStorePatterns } from '../../modules/ai/patterns/detectors.js'
import { evaluateCoach } from '../../modules/ai/coach/evaluate.js'

/** Core twin refresh (no lock) — used inside runAllJobs. */
export async function refreshStaleTwinsUnlocked({ limit = 50 } = {}) {
  const stale = await db().aiProfile.findMany({
    where: { stale: true },
    select: { userId: true },
    take: limit,
  })

  let rebuilt = 0
  for (const { userId } of stale) {
    await getOrBuildTwin(userId, { force: true })
    rebuilt += 1
  }

  return { scanned: stale.length, rebuilt }
}

/**
 * Light daily AI pass: rebuild stale twins, refresh patterns, coach digest.
 */
export async function runAiDigestUnlocked({ limit = 40 } = {}) {
  const twin = await refreshStaleTwinsUnlocked({ limit })

  const users = await db().user.findMany({
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })

  let patterns = 0
  let coach = 0
  for (const { id: userId } of users) {
    try {
      await detectAndStorePatterns(userId)
      patterns += 1
      const result = await evaluateCoach(userId, { event: 'digest' })
      coach += result.created
    } catch (err) {
      console.error('[jobs:ai] digest failed', userId, err?.message || err)
    }
  }

  return { twin, patterns, coachCreated: coach, users: users.length }
}

export async function refreshStaleTwins(opts) {
  return withJobLock('jobs:ai', () => refreshStaleTwinsUnlocked(opts))
}

export async function runAiDigest(opts) {
  return withJobLock('jobs:ai', () => runAiDigestUnlocked(opts))
}
