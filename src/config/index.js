import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

export const env = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  /**
   * inline — cron runs inside the API process (convenient for local dev)
   * worker — API does not schedule; run `npm run jobs:worker` separately
   * off    — no automatic scheduling (manual POST /jobs/run only)
   */
  jobsMode: String(process.env.JOBS_MODE || 'inline').toLowerCase(),
  aiProvider: String(process.env.AI_PROVIDER || 'none').toLowerCase(),
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-2.0-flash',
  aiEnabled: String(process.env.AI_ENABLED || 'true').toLowerCase() !== 'false',
}

export const prisma = new PrismaClient()
