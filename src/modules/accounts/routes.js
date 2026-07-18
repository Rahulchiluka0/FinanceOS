import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { accountsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(accountsController.list))
router.post('/', asyncHandler(accountsController.create))
router.patch('/:id', asyncHandler(accountsController.update))
router.post('/:id/archive', asyncHandler(accountsController.archive))
router.post('/transfer', asyncHandler(accountsController.transfer))

export default router
