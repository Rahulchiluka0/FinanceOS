import { db } from '../lib/prisma.js'

/** Stable int keys for pg_advisory_lock (app-specific namespace). */
const LOCK_KEYS = {
  'jobs:all': 720_001,
  'jobs:recurring': 720_002,
  'jobs:notifications': 720_003,
  'jobs:ai': 720_004,
}

/**
 * Run fn only if this process can acquire a Postgres session advisory lock.
 * Prevents duplicate runs when API + worker (or multiple instances) overlap.
 */
export async function withJobLock(name, fn) {
  const key = LOCK_KEYS[name] ?? 720_999
  const rows = await db().$queryRaw`SELECT pg_try_advisory_lock(${key}) AS acquired`
  const acquired = Boolean(rows?.[0]?.acquired)
  if (!acquired) {
    return { skipped: true, reason: 'lock_held' }
  }

  try {
    const result = await fn()
    return { skipped: false, result }
  } finally {
    await db().$queryRaw`SELECT pg_advisory_unlock(${key})`
  }
}
