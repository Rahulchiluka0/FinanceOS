/**
 * Dedicated job worker process.
 * Prefer this in production: API serves HTTP; worker runs cron.
 *
 *   JOBS_MODE=worker npm run start   # API only
 *   npm run jobs:worker              # this process
 */
import { prisma } from '../config/index.js'
import { startJobScheduler } from './scheduler.js'

async function main() {
  await prisma.$connect()
  startJobScheduler()
  console.log('[jobs] worker process running (Ctrl+C to stop)')
}

main().catch(async (err) => {
  console.error('[jobs] worker failed to start', err)
  await prisma.$disconnect()
  process.exit(1)
})

async function shutdown(signal) {
  console.log(`[jobs] worker received ${signal}, shutting down`)
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
