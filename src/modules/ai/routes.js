import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { aiController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/suggestions', asyncHandler(aiController.suggestions))
router.post('/chat', asyncHandler(aiController.chat))
router.get('/chat/threads', asyncHandler(aiController.chatThreads))
router.get('/chat/threads/:id', asyncHandler(aiController.chatThread))

router.get('/dashboard', asyncHandler(aiController.dashboard))
router.get('/profile', asyncHandler(aiController.profile))
router.post('/profile/refresh', asyncHandler(aiController.refreshProfile))
router.get('/health-score', asyncHandler(aiController.healthScore))

router.get('/patterns', asyncHandler(aiController.patterns))
router.post('/patterns/refresh', asyncHandler(aiController.refreshPatterns))

router.get('/insights', asyncHandler(aiController.insights))
router.post('/insights/refresh', asyncHandler(aiController.refreshCoach))
router.post('/insights/:id/dismiss', asyncHandler(aiController.dismissInsight))
router.post('/insights/:id/act', asyncHandler(aiController.actInsight))

export default router
