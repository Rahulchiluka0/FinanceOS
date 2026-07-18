import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { notificationsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(notificationsController.list))
router.patch('/:id/read', asyncHandler(notificationsController.markRead))
router.post('/read-all', asyncHandler(notificationsController.markAllRead))

export default router
