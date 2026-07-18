import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler, ok } from '../../utils/response.js'
import { runAllJobs } from '../../jobs/runner.js'

const router = Router()
router.use(authRequired)

/** Manual trigger (admin/dev). Safe under advisory lock if cron overlaps. */
router.post(
  '/run',
  asyncHandler(async (_req, res) => {
    const data = await runAllJobs()
    return ok(res, data)
  }),
)

export default router
