import { AppError } from '../../utils/response.js'
import { mapAccount, mapCategory, mapTransaction } from '../../utils/mappers.js'
import { transactionsRepository } from '../transactions/repository.js'
import { dataRepository } from './repository.js'

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = vals[i]?.trim() ?? ''
    })
    return row
  })
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\n',
  )
}

function resolveAccountId(accounts, nameOrId) {
  if (!nameOrId) return accounts[0]?.id || null
  const byId = accounts.find((a) => a.id === nameOrId)
  if (byId) return byId.id
  const byName = accounts.find((a) => a.name.toLowerCase() === String(nameOrId).toLowerCase())
  return byName?.id || accounts[0]?.id || null
}

function resolveCategoryId(categories, nameOrId, type) {
  if (!nameOrId) return null
  const byId = categories.find((c) => c.id === nameOrId)
  if (byId) return byId.id
  const byName = categories.find(
    (c) =>
      c.name.toLowerCase() === String(nameOrId).toLowerCase() &&
      (!type || c.type === type),
  )
  return byName?.id || null
}

export const dataService = {
  async exportBackup(userId) {
    const snapshot = await dataRepository.loadSnapshot(userId)
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: snapshot.accounts.map(mapAccount),
      categories: snapshot.categories.map(mapCategory),
      transactions: snapshot.transactions.map(mapTransaction),
      budgets: snapshot.budgets.map((b) => ({
        id: b.id,
        category: b.category?.name,
        categoryId: b.categoryId,
        period: b.period,
        limit: b.limitAmount,
        alertAt: b.alertAt,
      })),
      goals: snapshot.goals.map((g) => ({
        id: g.id,
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.deadline?.toISOString().slice(0, 10) || null,
        color: g.color,
        completed: g.completed,
      })),
      bills: snapshot.bills.map((b) => ({
        id: b.id,
        title: b.title,
        category: b.category,
        amount: b.amount,
        due: b.dueDate.toISOString().slice(0, 10),
        status: b.status,
      })),
      tags: snapshot.tags,
    }
  },

  async exportCsv(userId) {
    const snapshot = await dataRepository.loadSnapshot(userId)
    const rows = snapshot.transactions.map((t) => ({
      title: t.title,
      type: t.type,
      amount: t.amount,
      date: t.date.toISOString().slice(0, 10),
      account: t.account?.name || '',
      category: t.category?.name || '',
      notes: t.notes || '',
      tags: (t.tags || [])
        .map((x) => x.tag?.name)
        .filter(Boolean)
        .join('|'),
    }))
    return toCsv(rows, ['title', 'type', 'amount', 'date', 'account', 'category', 'notes', 'tags'])
  },

  async importTransactions(userId, body) {
    const format = String(body.format || 'json').toLowerCase()
    let rows = []

    if (format === 'csv') {
      rows = parseCsv(body.csv || body.content || '')
    } else {
      const raw = body.transactions || body.data?.transactions || body
      rows = Array.isArray(raw) ? raw : []
    }

    if (!rows.length) throw new AppError('No transactions to import')

    const [accounts, categories] = await Promise.all([
      dataRepository.findAccounts(userId),
      dataRepository.findCategories(userId),
    ])
    if (!accounts.length) throw new AppError('Create at least one account before importing')

    let imported = 0
    const errors = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const type = String(row.type || 'expense').toLowerCase()
        if (!['income', 'expense', 'transfer'].includes(type)) {
          throw new Error(`Invalid type "${row.type}"`)
        }
        const amount = Number(row.amount)
        if (!amount || amount <= 0) throw new Error('Invalid amount')

        const accountId = resolveAccountId(accounts, row.account || row.accountId)
        if (!accountId) throw new Error('No account found')

        const categoryId = resolveCategoryId(
          categories,
          row.category || row.categoryId,
          type === 'transfer' ? null : type,
        )

        const tags = row.tags
          ? String(row.tags)
              .split(/[|,]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : []

        await transactionsRepository.createWithBalanceAndTags(
          userId,
          {
            title: row.title || `Imported ${i + 1}`,
            type,
            amount,
            accountId,
            toAccountId: null,
            categoryId,
            date: row.date ? new Date(row.date) : new Date(),
            notes: row.notes || 'Imported',
            favorite: false,
            receiptUrl: null,
          },
          tags,
        )
        imported++
      } catch (err) {
        errors.push({ row: i + 1, message: err.message })
      }
    }

    return { imported, failed: errors.length, errors: errors.slice(0, 20) }
  },

  async restoreBackup(userId, backup) {
    const transactions = backup?.transactions || []
    if (!transactions.length) throw new AppError('Backup has no transactions to restore')
    return this.importTransactions(userId, { format: 'json', transactions })
  },
}
