import { AppError } from './response.js'

/** Credit cards may go more negative; other accounts cannot overdraft. */
export function assertCanDebit(account, amount) {
  if (!account) throw new AppError('Account not found', 404)
  if (account.type === 'credit_card') return

  const available = Number(account.balance)
  const need = Number(amount)
  if (Number.isNaN(need) || need <= 0) {
    throw new AppError('Amount must be greater than zero', 400)
  }
  if (available < need) {
    throw new AppError(
      `Insufficient balance. Available ₹${available.toLocaleString('en-IN')}, requested ₹${need.toLocaleString('en-IN')}.`,
      400,
      'INSUFFICIENT_BALANCE',
    )
  }
}
