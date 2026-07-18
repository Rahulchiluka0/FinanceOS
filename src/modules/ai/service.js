import { aiRepository } from './repository.js'

export const aiService = {
  getSuggestions() {
    return aiRepository.getSuggestions()
  },

  chat(message) {
    const text = String(message || '').toLowerCase()

    if (text.includes('budget')) {
      return {
        reply:
          'Your shopping budget is slightly over — consider pausing discretionary purchases this week.',
      }
    }
    if (text.includes('save')) {
      return {
        reply:
          "At 37% saving rate you're ahead of target. Redirect ₹5,000/month to your emergency fund.",
      }
    }
    if (text.includes('spend')) {
      return {
        reply:
          'Your top spending category this month is Bills. Review recurring charges for quick wins.',
      }
    }

    return { reply: aiRepository.getRandomTip() }
  },
}
