import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { usersController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/me', asyncHandler(usersController.getMe))
router.patch('/me', asyncHandler(usersController.updateMe))
router.post('/me/password', asyncHandler(usersController.changePassword))

export default router
