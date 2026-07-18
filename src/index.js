import { createApp } from './app.js'
import { env, prisma } from './config/index.js'
import { startJobScheduler } from './jobs/index.js'

const app = createApp()

async function main() {
  await prisma.$connect()
  app.listen(env.port, () => {
    console.log(`FinanceOS API running on http://localhost:${env.port}`)
    console.log(`Health: http://localhost:${env.port}/api/v1/health`)

    if (env.jobsMode === 'inline') {
      startJobScheduler()
    } else if (env.jobsMode === 'worker') {
      console.log('[jobs] JOBS_MODE=worker — start cron with: npm run jobs:worker')
    } else {
      console.log('[jobs] JOBS_MODE=off — use POST /api/v1/jobs/run to trigger manually')
    }
  })
}

main().catch(async (err) => {
  console.error('Failed to start server', err)
  await prisma.$disconnect()
  process.exit(1)
})
