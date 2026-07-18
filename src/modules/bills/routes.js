import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { billsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(billsController.list))
router.post('/', asyncHandler(billsController.create))
router.patch('/:id', asyncHandler(billsController.update))
router.post('/:id/pay', asyncHandler(billsController.pay))
router.delete('/:id', asyncHandler(billsController.remove))

export default router
