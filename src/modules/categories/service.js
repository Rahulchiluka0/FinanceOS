import { AppError } from '../../utils/response.js'
import { mapCategory } from '../../utils/mappers.js'
import { categoriesRepository } from './repository.js'

async function assertValidParent(userId, parentId, type) {
  if (!parentId) return
  const parent = await categoriesRepository.findByIdForUser(parentId, userId)
  if (!parent) throw new AppError('Parent category not found', 404)
  if (parent.parentId) throw new AppError('Parent must be a top-level category')
  if (type && parent.type !== type) {
    throw new AppError('Parent category must be the same type')
  }
}

export const categoriesService = {
  async list(userId) {
    const rows = await categoriesRepository.findManyByUser(userId)
    return rows.map(mapCategory)
  },

  async create(userId, body) {
    await assertValidParent(userId, body.parentId, body.type)

    const category = await categoriesRepository.create({
      userId,
      name: body.name,
      type: body.type,
      parentId: body.parentId || null,
      color: body.color || '#1A56DB',
      icon: body.icon || 'Tag',
    })
    return mapCategory(category)
  },

  async update(userId, id, body) {
    const existing = await categoriesRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Category not found', 404)

    if (body.parentId !== undefined) {
      if (body.parentId === id) throw new AppError('Category cannot be its own parent')
      await assertValidParent(userId, body.parentId, body.type || existing.type)
    }

    const category = await categoriesRepository.update(existing.id, {
      name: body.name,
      type: body.type,
      color: body.color,
      icon: body.icon,
      parentId: body.parentId,
      archived: body.archived,
    })
    return mapCategory(category)
  },

  async toggleArchive(userId, id) {
    const existing = await categoriesRepository.findByIdForUser(id, userId)
    if (!existing) throw new AppError('Category not found', 404)

    const category = await categoriesRepository.update(existing.id, {
      archived: !existing.archived,
    })
    return mapCategory(category)
  },
}
