import { db } from '../../lib/prisma.js'
import { transactionsRepository } from '../../modules/transactions/repository.js'
import { checkBudgetAlerts } from '../../modules/budgets/alerts.js'
import { markTwinStale } from '../../modules/ai/twin/invalidate.js'

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function advanceDate(date, frequency) {
  const d = new Date(date)
  const f = String(frequency || 'monthly').toLowerCase()
  if (f === 'daily') d.setDate(d.getDate() + 1)
  else if (f === 'weekly') d.setDate(d.getDate() + 7)
  else if (f === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

/** Create transactions for due recurring rules (idempotent per rule/day). */
export async function processDueRecurring() {
  const todayEnd = endOfDay()
  const due = await db().recurringRule.findMany({
    where: {
      status: 'active',
      nextDate: { lte: todayEnd },
    },
  })

  let created = 0
  let skippedNoAccount = 0
  for (const rule of due) {
    if (!rule.accountId) {
      skippedNoAccount++
      continue
    }
    const dayStart = startOfDay(rule.nextDate)
    const dayEnd = endOfDay(rule.nextDate)

    const already = await db().transaction.findFirst({
      where: {
        userId: rule.userId,
        recurringId: rule.id,
        date: { gte: dayStart, lte: dayEnd },
      },
    })

    if (!already) {
      const tx = await transactionsRepository.createWithBalanceAndTags(
        rule.userId,
        {
          title: rule.title,
          type: rule.type,
          amount: rule.amount,
          accountId: rule.accountId,
          toAccountId: null,
          categoryId: rule.categoryId,
          date: rule.nextDate,
          notes: 'Auto-created from recurring rule',
          favorite: false,
          receiptUrl: null,
          recurringId: rule.id,
        },
        [],
      )
      created++
      await markTwinStale(rule.userId)

      const sign = rule.type === 'income' ? '+' : '-'
      try {
        await db().notification.create({
          data: {
            userId: rule.userId,
            type: 'recurring',
            title: 'Recurring transaction created',
            body: `${rule.title} (${sign}₹${Number(rule.amount).toLocaleString('en-IN')}) was posted automatically.`,
            meta: JSON.stringify({
              recurringId: rule.id,
              transactionId: tx.id,
              kind: 'posted',
            }),
          },
        })
      } catch (err) {
        console.error('[jobs:recurring] failed to create posted notification', err?.message || err)
      }

      if (tx.type === 'expense' && tx.categoryId) {
        await checkBudgetAlerts(rule.userId, tx.categoryId).catch((err) => {
          console.error('[jobs:recurring] budget alert failed', err?.message || err)
        })
      }
    }

    await db().recurringRule.update({
      where: { id: rule.id },
      data: { nextDate: advanceDate(rule.nextDate, rule.frequency) },
    })
  }

  return { scanned: due.length, created, skippedNoAccount }
}
