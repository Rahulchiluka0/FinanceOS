import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/index.js'
import { errorHandler, notFound } from './middleware/error.js'
import { ok, asyncHandler } from './utils/response.js'
import { authRequired } from './middleware/auth.js'

import authRoutes from './modules/auth/routes.js'
import usersRoutes from './modules/users/routes.js'
import accountsRoutes from './modules/accounts/routes.js'
import categoriesRoutes from './modules/categories/routes.js'
import transactionsRoutes from './modules/transactions/routes.js'
import tagsRoutes from './modules/tags/routes.js'
import budgetsRoutes from './modules/budgets/routes.js'
import goalsRoutes from './modules/goals/routes.js'
import recurringRoutes from './modules/recurring/routes.js'
import dashboardRoutes from './modules/dashboard/routes.js'
import billsRoutes from './modules/bills/routes.js'
import subscriptionsRoutes from './modules/subscriptions/routes.js'
import loansRoutes from './modules/loans/routes.js'
import investmentsRoutes from './modules/investments/routes.js'
import notificationsRoutes from './modules/notifications/routes.js'
import calendarRoutes from './modules/calendar/routes.js'
import searchRoutes from './modules/search/routes.js'
import reportsRoutes from './modules/reports/routes.js'
import fxRoutes from './modules/fx/routes.js'
import aiRoutes from './modules/ai/routes.js'
import { aiController } from './modules/ai/controller.js'
import dataRoutes from './modules/data/routes.js'
import jobsRoutes from './modules/jobs/routes.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))
  app.use(morgan('dev'))

  app.get('/api/v1/health', (_req, res) =>
    ok(res, { status: 'ok', service: 'financeos-server', time: new Date().toISOString() }),
  )

  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/users', usersRoutes)
  app.use('/api/v1/accounts', accountsRoutes)
  app.use('/api/v1/categories', categoriesRoutes)
  app.use('/api/v1/transactions', transactionsRoutes)
  app.use('/api/v1/tags', tagsRoutes)
  app.use('/api/v1/budgets', budgetsRoutes)
  app.use('/api/v1/goals', goalsRoutes)
  app.use('/api/v1/recurring', recurringRoutes)
  app.use('/api/v1/dashboard', dashboardRoutes)
  app.use('/api/v1/bills', billsRoutes)
  app.use('/api/v1/subscriptions', subscriptionsRoutes)
  app.use('/api/v1/loans', loansRoutes)
  app.use('/api/v1/investments', investmentsRoutes)
  app.use('/api/v1/notifications', notificationsRoutes)
  app.use('/api/v1/calendar', calendarRoutes)
  app.use('/api/v1/search', searchRoutes)
  app.use('/api/v1/reports', reportsRoutes)
  app.use('/api/v1/fx', fxRoutes)
  app.use('/api/v1/ai', aiRoutes)
  app.get('/api/v1/insights/smart', authRequired, asyncHandler(aiController.smartInsights))
  app.use('/api/v1/data', dataRoutes)
  app.use('/api/v1/jobs', jobsRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
