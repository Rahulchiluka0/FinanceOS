/** Allowlisted Ask My Money tool definitions (Gemini functionDeclarations). */

export const TOOL_NAMES = [
  'spend_by_category',
  'spend_by_merchant',
  'cashflow_period',
  'list_transactions',
  'budget_status',
  'goal_status',
  'subscription_costs',
  'net_worth',
  'twin_summary',
]

export const geminiToolDeclarations = [
  {
    name: 'spend_by_category',
    description: 'Total expense by category for a period. Use for "how much did I spend on X".',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          description: 'this_month | last_month | YYYY-MM',
        },
        categoryName: {
          type: 'STRING',
          description: 'Optional category name filter (partial match)',
        },
      },
    },
  },
  {
    name: 'spend_by_merchant',
    description: 'Group expenses by transaction title (merchant proxy).',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', description: 'this_month | last_month | YYYY-MM' },
        query: { type: 'STRING', description: 'Optional title search' },
        limit: { type: 'NUMBER', description: 'Max merchants (default 8)' },
      },
    },
  },
  {
    name: 'cashflow_period',
    description: 'Income, expense, and net for a period.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING', description: 'this_month | last_month | YYYY-MM' },
      },
    },
  },
  {
    name: 'list_transactions',
    description: 'List recent transactions with optional type/category/search filters.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { type: 'STRING' },
        type: { type: 'STRING', description: 'expense | income | transfer | all' },
        categoryName: { type: 'STRING' },
        query: { type: 'STRING' },
        limit: { type: 'NUMBER' },
      },
    },
  },
  {
    name: 'budget_status',
    description: 'Budget limits vs spent for the current period.',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoryName: { type: 'STRING' },
      },
    },
  },
  {
    name: 'goal_status',
    description: 'Savings goals progress.',
    parameters: {
      type: 'OBJECT',
      properties: {
        includeCompleted: { type: 'BOOLEAN' },
      },
    },
  },
  {
    name: 'subscription_costs',
    description: 'Active subscription monthly cost total and list.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'net_worth',
    description: 'Net worth: balances + investments − loans.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'twin_summary',
    description: 'Financial Twin snapshot: savings rate, runway, health, risk.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
]

export const SYSTEM_PROMPT = `You are Ask My Money for FinanceOS, a personal finance app (INR, India-friendly).

Rules:
- Use ONLY the provided tools to get numbers. Never invent balances, spends, or dates.
- Call one or more tools when the user asks about their money.
- After tool results, answer in clear plain language using ONLY those facts.
- If tools return empty/insufficient data, say what is missing (category, date range, or more transactions).
- Label advice as tips; never claim you moved money.
- Keep answers concise (2–5 sentences) unless asked for detail.
- Currency formatting: use ₹ and Indian grouping when stating amounts.`

export const NARRATION_PROMPT = `You narrate FinanceOS Ask My Money answers.
Use ONLY the JSON facts provided. Do not invent numbers.
If facts are empty, ask a clarifying question.
Be concise, friendly, and specific. Use ₹ for money.`
