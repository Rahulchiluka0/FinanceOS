import { AppError } from '../../utils/response.js'
import { tagsRepository } from './repository.js'

function normalizeTagName(name) {
  return name.replace(/^#/, '').trim().toLowerCase()
}

function mapTag(t, countOverride) {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    count: countOverride ?? t._count?.transactions ?? 0,
  }
}

export const tagsService = {
  async list(userId) {
    const rows = await tagsRepository.findManyByUser(userId)
    return rows.map((t) => mapTag(t))
  },

  async create(userId, body) {
    const name = normalizeTagName(body.name)
    const tag = await tagsRepository.create({
      userId,
      name,
      color: body.color || '#1A56DB',
    })
    return mapTag(tag, 0)
  },

  async update(userId, id, body) {
    const existing = await tagsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Tag not found', 404)

    const tag = await tagsRepository.update(existing.id, {
      name: body.name ? normalizeTagName(body.name) : undefined,
      color: body.color,
    })
    return mapTag(tag)
  },

  async remove(userId, id) {
    const existing = await tagsRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Tag not found', 404)

    await tagsRepository.delete(existing.id)
    return { id: existing.id, deleted: true }
  },
}
