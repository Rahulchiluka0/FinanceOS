import cron from 'node-cron'
import { runAllJobs } from './runner.js'

let started = false
const tasks = []

function logRun(label, result) {
  console.log(`[jobs] ${label}`, JSON.stringify(result))
}

/**
 * Schedule background work with node-cron.
 * Default: every 5 minutes (override JOBS_CRON, e.g. every-5-min cron).
 */
export function startJobScheduler({ timezone } = {}) {
  if (started) return
  started = true

  const expression = process.env.JOBS_CRON || '*/5 * * * *'
  if (!cron.validate(expression)) {
    throw new Error(`Invalid JOBS_CRON expression: ${expression}`)
  }

  const tz = timezone || process.env.JOBS_TZ || process.env.TZ || 'Asia/Kolkata'

  const task = cron.schedule(
    expression,
    () => {
      runAllJobs()
        .then((r) => logRun('tick', r))
        .catch((err) => console.error('[jobs] tick failed', err.message))
    },
    { timezone: tz },
  )
  tasks.push(task)

  // One catch-up shortly after boot (does not wait for next cron slot)
  setTimeout(() => {
    runAllJobs()
      .then((r) => logRun('boot', r))
      .catch((err) => console.error('[jobs] boot failed', err.message))
  }, 2500)

  console.log(`[jobs] cron started (${expression}, tz=${tz})`)
}

export function stopJobScheduler() {
  for (const t of tasks) t.stop()
  tasks.length = 0
  started = false
}
