import { Router } from 'express'
import { authRequired } from '../../middleware/auth.js'
import { asyncHandler } from '../../utils/response.js'
import { dataController } from './controller.js'

const router = Router()
router.use(authRequired)

router.get('/backup', asyncHandler(dataController.exportBackup))
router.get('/export/csv', asyncHandler(dataController.exportCsv))
router.post('/import', asyncHandler(dataController.importTransactions))
router.post('/restore', asyncHandler(dataController.restore))

export default router
