import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { goalsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(goalsController.list))
router.post('/', asyncHandler(goalsController.create))
router.patch('/:id', asyncHandler(goalsController.update))
router.delete('/:id', asyncHandler(goalsController.remove))
router.post('/:id/deposit', asyncHandler(goalsController.deposit))
router.post('/:id/withdraw', asyncHandler(goalsController.withdraw))

export default router
