import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { tagsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(tagsController.list))
router.post('/', asyncHandler(tagsController.create))
router.patch('/:id', asyncHandler(tagsController.update))
router.delete('/:id', asyncHandler(tagsController.remove))

export default router
