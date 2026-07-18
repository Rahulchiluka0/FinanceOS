import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { fxController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/rates', asyncHandler(fxController.rates))
router.post('/convert', asyncHandler(fxController.convert))

export default router
