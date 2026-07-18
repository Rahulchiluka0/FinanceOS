import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { investmentsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(investmentsController.list))
router.post('/', asyncHandler(investmentsController.create))
router.patch('/:id', asyncHandler(investmentsController.update))
router.delete('/:id', asyncHandler(investmentsController.remove))

export default router
