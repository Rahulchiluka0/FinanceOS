import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { aiController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/suggestions', asyncHandler(aiController.suggestions))
router.post('/chat', asyncHandler(aiController.chat))

export default router
