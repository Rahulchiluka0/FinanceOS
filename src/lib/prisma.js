import { prisma } from '../config/index.js'

/** Shared Prisma client accessor for repositories */
export function db() {
  return prisma
}
