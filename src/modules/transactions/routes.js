import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { transactionsController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(transactionsController.list))
router.post('/', asyncHandler(transactionsController.create))
router.patch('/:id', asyncHandler(transactionsController.update))
router.delete('/:id', asyncHandler(transactionsController.remove))
router.post('/bulk-delete', asyncHandler(transactionsController.bulkRemove))
router.post('/:id/duplicate', asyncHandler(transactionsController.duplicate))
router.post('/:id/favorite', asyncHandler(transactionsController.toggleFavorite))

export default router
