import { db } from '../../../lib/prisma.js'
import { aiProvider, narrateTemplate } from '../../../lib/ai/provider.js'
import { TOOL_NAMES } from '../../../lib/ai/tools.js'
import { executeTool, inferToolsFromMessage } from './tools.js'

const chatWindowMs = 60_000
const chatLimit = 20
const chatHits = new Map()

function rateLimitChat(userId) {
  const now = Date.now()
  const bucket = chatHits.get(userId) || []
  const recent = bucket.filter((t) => now - t < chatWindowMs)
  if (recent.length >= chatLimit) {
    const err = new Error('Too many chat requests — try again in a minute')
    err.status = 429
    err.code = 'RATE_LIMITED'
    throw err
  }
  recent.push(now)
  chatHits.set(userId, recent)
}

function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(args)) {
    if (v == null) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

async function ensureThread(userId, threadId, firstMessage) {
  if (threadId) {
    const existing = await db().aiChatThread.findFirst({
      where: { id: threadId, userId },
    })
    if (existing) return existing
  }
  const title = String(firstMessage || 'Ask My Money').trim().slice(0, 80)
  return db().aiChatThread.create({
    data: { userId, title },
  })
}

async function loadHistory(threadId, limit = 8) {
  const rows = await db().aiChatMessage.findMany({
    where: { threadId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.reverse().map((r) => ({
    role: r.role === 'assistant' ? 'assistant' : 'user',
    content: r.content,
  }))
}

/**
 * Ask My Money pipeline: tools → facts → narrate (Gemini or template).
 */
export async function askMyMoney(userId, { message, threadId = null, client = 'web' } = {}) {
  rateLimitChat(userId)
  const text = String(message || '').trim()
  if (!text) {
    const err = new Error('Message is required')
    err.status = 400
    throw err
  }

  const thread = await ensureThread(userId, threadId, text)
  const history = await loadHistory(thread.id)

  await db().aiChatMessage.create({
    data: { threadId: thread.id, role: 'user', content: text, facts: '[]' },
  })

  let toolCalls = []
  let provider = 'heuristic'

  if (aiProvider.isLive()) {
    try {
      const plan = await aiProvider.planTools(text, history)
      toolCalls = (plan.functionCalls || [])
        .filter((c) => TOOL_NAMES.includes(c.name))
        .map((c) => ({ name: c.name, args: sanitizeArgs(c.args) }))
      provider = 'gemini'
      // If model answered without tools but we need data, fall back to heuristic tools
      if (!toolCalls.length && !plan.text) {
        toolCalls = inferToolsFromMessage(text)
        provider = 'gemini+heuristic'
      } else if (!toolCalls.length && plan.text) {
        // Model tried to answer without tools — still ground with heuristic tools
        toolCalls = inferToolsFromMessage(text)
        provider = 'gemini+grounded'
      }
    } catch (err) {
      console.error('[ask-my-money] gemini plan failed', err?.message || err)
      toolCalls = inferToolsFromMessage(text)
      provider = 'heuristic-fallback'
    }
  } else {
    toolCalls = inferToolsFromMessage(text)
  }

  const facts = []
  const citations = []
  const toolsUsed = []

  for (const call of toolCalls.slice(0, 4)) {
    try {
      const result = await executeTool(userId, call.name, call.args)
      toolsUsed.push({ name: call.name, args: call.args })
      for (const f of result.facts || []) facts.push(f)
      for (const c of result.citations || []) citations.push(c)

      await db().aiChatMessage.create({
        data: {
          threadId: thread.id,
          role: 'tool',
          content: JSON.stringify({ tool: call.name, args: call.args, data: result.data }),
          facts: JSON.stringify(result.facts || []),
        },
      })
    } catch (err) {
      console.error('[ask-my-money] tool failed', call.name, err?.message || err)
    }
  }

  let answer
  try {
    answer = await aiProvider.narrate(text, facts, citations)
  } catch (err) {
    console.error('[ask-my-money] narrate failed', err?.message || err)
    answer = narrateTemplate(text, facts, citations)
  }

  await db().aiChatMessage.create({
    data: {
      threadId: thread.id,
      role: 'assistant',
      content: answer,
      facts: JSON.stringify(facts),
    },
  })

  await db().aiChatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  })

  return {
    reply: answer,
    answer,
    facts,
    citations,
    toolsUsed,
    threadId: thread.id,
    provider,
    client,
    asOf: new Date().toISOString(),
  }
}

export async function listThreads(userId, { limit = 20 } = {}) {
  const rows = await db().aiChatThread.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(50, Number(limit) || 20),
    include: {
      messages: {
        where: { role: 'user' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })
  return rows.map((t) => ({
    id: t.id,
    title: t.title || t.messages[0]?.content?.slice(0, 60) || 'Chat',
    updatedAt: t.updatedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }))
}

export async function getThread(userId, threadId) {
  const thread = await db().aiChatThread.findFirst({
    where: { id: threadId, userId },
    include: {
      messages: {
        where: { role: { in: ['user', 'assistant'] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!thread) return null
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      facts: JSON.parse(m.facts || '[]'),
      createdAt: m.createdAt.toISOString(),
    })),
  }
}
