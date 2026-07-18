import { AppError } from '../../utils/response.js'
import { fxRepository } from './repository.js'

export const fxService = {
  getRates() {
    return fxRepository.getRates()
  },

  convert({ amount, from, to }) {
    const fromRate = fxRepository.findRate(from)
    const toRate = fxRepository.findRate(to)
    if (!fromRate || !toRate) throw new AppError('Unsupported currency code')

    const inInr = amount / fromRate.rate
    const converted = inInr * toRate.rate

    return {
      amount,
      from,
      to,
      result: Math.round(converted * 10000) / 10000,
      rate: toRate.rate / fromRate.rate,
    }
  },
}
