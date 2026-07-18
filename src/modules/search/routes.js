import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { searchController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/', asyncHandler(searchController.search))

export default router
