import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { subscriptionsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(subscriptionsController.list))
router.post('/', asyncHandler(subscriptionsController.create))
router.patch('/:id', asyncHandler(subscriptionsController.update))
router.post('/:id/pause', asyncHandler(subscriptionsController.pause))
router.post('/:id/resume', asyncHandler(subscriptionsController.resume))
router.delete('/:id', asyncHandler(subscriptionsController.remove))

export default router
