import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { recurringController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(recurringController.list))
router.post('/', asyncHandler(recurringController.create))
router.patch('/:id', asyncHandler(recurringController.update))
router.post('/:id/pause', asyncHandler(recurringController.pause))
router.post('/:id/resume', asyncHandler(recurringController.resume))
router.post('/:id/end', asyncHandler(recurringController.end))
router.post('/:id/skip', asyncHandler(recurringController.skip))
router.delete('/:id', asyncHandler(recurringController.remove))

export default router
