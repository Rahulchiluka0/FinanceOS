import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { budgetsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(budgetsController.list))
router.post('/', asyncHandler(budgetsController.create))
router.patch('/:id', asyncHandler(budgetsController.update))
router.delete('/:id', asyncHandler(budgetsController.remove))

export default router
