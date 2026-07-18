export function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    currency: user.currency,
    timezone: user.timezone,
    dateFormat: user.dateFormat,
    theme: user.theme,
    notificationPrefs: safeJson(user.notificationPrefs, {}),
    createdAt: user.createdAt,
  }
}

export function safeJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function mapAccount(a) {
  return {
    id: a.id,
    name: a.name,
    type: formatAccountType(a.type),
    currency: a.currency,
    openingBalance: a.openingBalance,
    balance: a.balance,
    color: a.color,
    icon: a.icon,
    archived: a.archived,
  }
}

function formatAccountType(type) {
  const map = {
    cash: 'Cash',
    bank: 'Bank',
    wallet: 'Wallet',
    credit_card: 'Credit Card',
    upi: 'UPI',
  }
  return map[type] || type
}

export function parseAccountType(type) {
  const map = {
    Cash: 'cash',
    Bank: 'bank',
    Wallet: 'wallet',
    'Credit Card': 'credit_card',
    UPI: 'upi',
  }
  return map[type] || String(type || 'bank').toLowerCase().replace(/\s+/g, '_')
}

export function mapTransaction(t) {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    amount: t.amount,
    date: t.date?.toISOString?.().slice(0, 10) || t.date,
    notes: t.notes || '',
    favorite: t.favorite,
    receipt: Boolean(t.receiptUrl),
    receiptUrl: t.receiptUrl,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    categoryId: t.categoryId,
    account: t.account?.name || null,
    toAccount: t.toAccount?.name || null,
    category: t.category?.name || null,
    tags: (t.tags || []).map((x) => x.tag?.name || x.name).filter(Boolean),
  }
}

export function mapCategory(c) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    parent: c.parent?.name || null,
    parentId: c.parentId,
    color: c.color,
    icon: c.icon,
    archived: c.archived,
  }
}
