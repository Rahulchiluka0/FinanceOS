import { searchRepository } from './repository.js'

export const searchService = {
  async search(userId, query = '') {
    const q = String(query.q || '').trim()
    if (!q) {
      return { transactions: [], accounts: [], bills: [], goals: [] }
    }

    const [transactions, accounts, bills, goals] = await Promise.all([
      searchRepository.searchTransactions(userId, q),
      searchRepository.searchAccounts(userId, q),
      searchRepository.searchBills(userId, q),
      searchRepository.searchGoals(userId, q),
    ])

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        amount: t.amount,
        date: t.date.toISOString().slice(0, 10),
        category: t.category?.name || null,
        account: t.account?.name || null,
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
      })),
      bills: bills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: b.amount,
        due: b.dueDate.toISOString().slice(0, 10),
        status: b.status,
      })),
      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
      })),
    }
  },
}
