import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { categoriesController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(categoriesController.list))
router.post('/', asyncHandler(categoriesController.create))
router.patch('/:id', asyncHandler(categoriesController.update))
router.post('/:id/archive', asyncHandler(categoriesController.archive))

export default router
