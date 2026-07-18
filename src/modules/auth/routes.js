import { Router } from 'express'
import { asyncHandler } from '../../utils/response.js'
import { authController } from './controller.js'

const router = Router()

router.post('/register', asyncHandler(authController.register))
router.post('/login', asyncHandler(authController.login))
router.post('/logout', asyncHandler(authController.logout))
router.post('/forgot-password', asyncHandler(authController.forgotPassword))
router.post('/reset-password', asyncHandler(authController.resetPassword))

export default router
