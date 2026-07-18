import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { dashboardController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(dashboardController.getSummary))

export default router
