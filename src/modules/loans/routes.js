import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { loansController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(loansController.list))
router.post('/', asyncHandler(loansController.create))
router.patch('/:id', asyncHandler(loansController.update))
router.delete('/:id', asyncHandler(loansController.remove))
router.get('/:id/schedule', asyncHandler(loansController.schedule))

export default router
