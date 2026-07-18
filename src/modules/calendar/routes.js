import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { calendarController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(calendarController.getMonth))

export default router
