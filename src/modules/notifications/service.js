import { AppError } from '../../utils/response.js'
import { notificationsRepository } from './repository.js'

function relativeTime(date) {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toISOString().slice(0, 10)
}

function mapNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    time: relativeTime(n.createdAt),
    createdAt: n.createdAt.toISOString(),
  }
}

export const notificationsService = {
  async list(userId, query = {}) {
    const unreadOnly = query.unread === 'true' || query.unread === true
    const rows = await notificationsRepository.findManyByUser(userId, unreadOnly)
    return rows.map(mapNotification)
  },

  async markRead(userId, id) {
    const existing = await notificationsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Notification not found', 404)

    const n = await notificationsRepository.markRead(existing.id)
    return mapNotification(n)
  },

  async markAllRead(userId) {
    const result = await notificationsRepository.markAllRead(userId)
    return { updated: result.count }
  },
}
