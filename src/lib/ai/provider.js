import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiToolDeclarations, SYSTEM_PROMPT, NARRATION_PROMPT } from './tools.js'

export function getAiConfig() {
  const provider = String(process.env.AI_PROVIDER || 'none').toLowerCase()
  const apiKey = process.env.AI_API_KEY || ''
  const model = process.env.AI_MODEL || 'gemini-2.0-flash'
  const enabled = String(process.env.AI_ENABLED || 'true').toLowerCase() !== 'false'
  const useGemini = enabled && provider === 'gemini' && Boolean(apiKey)
  return { provider, apiKey, model, enabled, useGemini }
}

function extractText(result) {
  try {
    return result?.response?.text?.() || ''
  } catch {
    return ''
  }
}

function extractFunctionCalls(result) {
  const calls = []
  try {
    const parts = result?.response?.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part.functionCall?.name) {
        calls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        })
      }
    }
  } catch {
    /* ignore */
  }
  return calls
}

export const aiProvider = {
  isLive() {
    return getAiConfig().useGemini
  },

  /**
   * Ask Gemini which tools to call (function-calling round).
   * @returns {{ text: string, functionCalls: {name, args}[] }}
   */
  async planTools(userMessage, history = []) {
    const cfg = getAiConfig()
    if (!cfg.useGemini) return { text: '', functionCalls: [] }

    const genAI = new GoogleGenerativeAI(cfg.apiKey)
    const model = genAI.getGenerativeModel({
      model: cfg.model,
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: geminiToolDeclarations }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    })

    const chat = model.startChat({
      history: history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    const result = await chat.sendMessage(userMessage)
    return {
      text: extractText(result),
      functionCalls: extractFunctionCalls(result),
      raw: result,
    }
  },

  /**
   * Narrate using only structured facts (no tools).
   */
  async narrate(userMessage, facts, citations = []) {
    const cfg = getAiConfig()
    if (!cfg.useGemini) {
      return narrateTemplate(userMessage, facts, citations)
    }

    const genAI = new GoogleGenerativeAI(cfg.apiKey)
    const model = genAI.getGenerativeModel({
      model: cfg.model,
      systemInstruction: NARRATION_PROMPT,
    })

    const payload = JSON.stringify({ question: userMessage, facts, citations }, null, 2)
    const result = await model.generateContent(
      `Answer the user using only these facts:\n${payload}`,
    )
    const text = extractText(result).trim()
    return text || narrateTemplate(userMessage, facts, citations)
  },
}

export function narrateTemplate(userMessage, facts, citations = []) {
  if (!facts?.length) {
    return 'I need a bit more detail — try a category or period (e.g. “food last month” or “my budgets”).'
  }

  const lines = facts.slice(0, 6).map((f) => {
    if (f.label && f.value != null) return `• ${f.label}: ${f.value}`
    return `• ${JSON.stringify(f)}`
  })
  const cite = citations[0]
    ? `\n(${citations.map((c) => [c.period, c.filters].filter(Boolean).join(' · ')).join('; ')})`
    : ''
  return `Here’s what your FinanceOS data shows:\n${lines.join('\n')}${cite}`
}
