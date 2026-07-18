const EXCHANGE_RATES = [
  { code: 'INR', name: 'Indian Rupee', rate: 1 },
  { code: 'USD', name: 'US Dollar', rate: 0.012 },
  { code: 'EUR', name: 'Euro', rate: 0.011 },
  { code: 'GBP', name: 'British Pound', rate: 0.0094 },
  { code: 'AED', name: 'UAE Dirham', rate: 0.044 },
]

export const fxRepository = {
  getRates() {
    return EXCHANGE_RATES
  },

  findRate(code) {
    return EXCHANGE_RATES.find((r) => r.code === code)
  },
}
