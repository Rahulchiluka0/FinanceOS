import { db } from '../../../lib/prisma.js'

/** Mark Financial Twin stale after ledger mutations (no queue — DB flag only). */
export async function markTwinStale(userId) {
  if (!userId) return
  try {
    await db().aiProfile.upsert({
      where: { userId },
      create: { userId, stale: true, profile: '{}', version: 1 },
      update: { stale: true },
    })
  } catch {
    // Twin table may not exist yet during migrate; never block finance writes
  }
}
