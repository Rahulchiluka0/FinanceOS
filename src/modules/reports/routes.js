import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { reportsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/overview', asyncHandler(reportsController.overview))
router.get('/cashflow', asyncHandler(reportsController.cashflow))
router.get('/categories', asyncHandler(reportsController.categories))

export default router
