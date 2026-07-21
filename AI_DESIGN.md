# FinanceOS AI Intelligence Suite

### Product & Technical Design Document (v1.0)

**Status:** Proposed  
**Audience:** Product, backend, web, mobile  
**Companion docs:** `[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)`, `[TEST_FLOWS.md](../TEST_FLOWS.md)`  
**Last updated:** 2026-07-21

---

## 1. Executive summary

FinanceOS already ships a full personal-finance stack (accounts, transactions, budgets, goals, investments, loans, bills, subscriptions, reports, notifications, calendar, import/export) across **web**, **API**, and **Expo mobile**.

Today’s “AI” is thin:


| Surface                                | Current state                                    |
| -------------------------------------- | ------------------------------------------------ |
| `POST /ai/chat`, `GET /ai/suggestions` | Rule-based stubs (keyword tips)                  |
| Dashboard health score                 | Simple formula: `clamp(50 + savingRate, 0, 100)` |
| Smart Insights (`/insights`)           | Client-computed blurbs from loaded lists         |
| `GET /insights/smart`                  | Designed in `SYSTEM_DESIGN.md`, not implemented  |


The **AI Intelligence Suite** upgrades FinanceOS from a tracker into a **Personal CFO** experience by introducing one shared brain — the **Financial Twin** — and seven product surfaces that all read from it.

**Non-negotiable principle:** modules remain the source of truth. AI never silently mutates balances, transactions, or goals. It **analyzes, explains, suggests, and simulates**.

---

## 2. Goals & non-goals

### Goals

- One financial context shared by every AI feature (no duplicated analytics).
- Answers and advice grounded only in the user’s FinanceOS data (no hallucinated numbers).
- Proactive coaching that feels timely, not spammy.
- Top-tier UX: glanceable health, conversational Ask My Money, safe Life Simulator, story-like Money Replay.
- Works the same on **web** and **mobile** against the same APIs.

### Non-goals (v1)

- Replacing Account Aggregator / SMS auto-import (separate roadmap).
- Autonomous money movement (payments, investments, EMI scheduling without user confirm).
- Training a custom foundation model (use a hosted LLM + tool/query layer).
- Fully offline AI on mobile.

---

## 3. Current system fit

```
Existing modules (source of truth)
  accounts · transactions · budgets · goals · investments
  loans · bills · subscriptions · categories · tags
  reports · dashboard · notifications · recurring · calendar
        │
        ▼
AI Intelligence Layer  (new)
  twin builder · pattern engine · health engine · coach · NLQ · simulator · replay
        │
        ▼
Financial Twin (cached profile + derived metrics)
        │
        ├── AI Coach / insights / notifications
        ├── Ask My Money (chat + tools)
        ├── Life Simulator (ephemeral)
        ├── Patterns / Health / Goal recommendations
        └── Money Replay narratives
```

**Reuse, don’t rewrite**


| Existing capability                 | How AI Suite uses it                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `GET /dashboard`                    | Seed twin cashflow / nets; evolve health score into multi-factor |
| `GET /reports/`*                    | Aggregates for Ask My Money + Replay                             |
| Budget alerts (`budgets/alerts.js`) | Trigger coach insights on overspend                              |
| Jobs (`jobs/tasks/*`)               | Nightly/periodic twin refresh + patterns + replay drafts         |
| Notifications                       | Deliver coach insights (`type: ai_coach`)                        |
| Web `/ai`, mobile AI tab            | Evolve into AI Intelligence hub                                  |
| Web/mobile `/insights`              | Merge into Patterns + Coach cards                                |


---

## 4. Product architecture — single AI ecosystem

Eight features are **not** eight products. They are **views and tools** on one Twin.


| Product surface          | Twin role                                   |
| ------------------------ | ------------------------------------------- |
| **Financial Twin**       | Canonical profile + context for LLM         |
| **AI Coach**             | Proactive insights from Twin deltas         |
| **Life Simulator**       | Clone Twin → apply scenario → project       |
| **Ask My Money**         | NL → tools/SQL-safe queries → narrate facts |
| **Spending Patterns**    | Batch analytics stored as `ai_patterns`     |
| **Health Score**         | Multi-factor score from Twin metrics        |
| **Goal Recommendations** | Suggest goals from surplus + priorities     |
| **Money Replay**         | Narrative timeline for a period             |


---

## 5. UX principles (top-notch experience)

1. **Facts vs advice vs forecasts** — always labeled in UI (chips: Fact · Tip · Projection).
2. **Explainability** — every number links to “How calculated” (period, filters, formula).
3. **Confirm before mutate** — simulator “Apply” and goal “Create” are explicit actions.
4. **Progressive disclosure** — Dashboard: score + 3 insights; AI hub: deep tools.
5. **Calm by default** — coach rate-limited; critical only for risk (runway < 1 month, severe overspend).
6. **Same language everywhere** — Twin vocabulary (savings rate, runway, debt ratio) shared by chat, cards, replay.
7. **Mobile-first actions** — large confirm CTAs; short cards; Ask My Money as primary tab entry.
8. **Empty states that teach** — if < 14 days of data, show “Twin warming up” with checklist (add salary, budgets, goals).

### AI Intelligence hub IA

```
AI Intelligence
├── Overview          ← score, twin snapshot, top 3 coach cards
├── Personal CFO      ← Twin profile detail + “what changed”
├── Ask My Money      ← conversational (replaces thin AI Assistant)
├── Financial Health  ← factor breakdown + improve plan
├── Smart Insights    ← coach feed (filter: all / money / goals / risk)
├── Spending Patterns ← charts + pattern cards
├── Goal Planner      ← recommendations → one-tap create goal
├── Life Simulator    ← scenario templates + custom
└── Money Replay      ← period picker + story timeline
```

**Web:** new sidebar section **AI Intelligence** (keep `/ai` as Ask My Money deep link).  
**Mobile:** evolve AI tab into hub; Insights moves under it.

---

## 6. Feature designs

### 6.1 Financial Twin (Personal CFO) — the brain

**Purpose:** Continuous, structured understanding of the user’s financial life.

**Build strategy**

1. **Deterministic builder** (server) aggregates Prisma data into a versioned JSON profile.
2. **LLM context pack** is a *projection* of that profile (token-budgeted), never the only source of numbers.
3. Profile is **cached** per user; invalidated/rebuild on material events and nightly job.

**Profile schema (logical)**

```json
{
  "userId": "...",
  "asOf": "2026-07-21T00:00:00Z",
  "version": 3,
  "currency": "INR",
  "period": { "month": "2026-07", "from": "...", "to": "..." },
  "cash": {
    "totalBalance": 0,
    "liquidBalance": 0,
    "monthlyIncome": 0,
    "monthlyExpense": 0,
    "netCashflow": 0,
    "savingsRate": 0
  },
  "wealth": {
    "netWorth": 0,
    "invested": 0,
    "investmentRatio": 0
  },
  "debt": {
    "totalDebt": 0,
    "emiMonthly": 0,
    "debtToIncome": 0
  },
  "buffers": {
    "emergencyFundMonths": 0,
    "runwayMonths": 0
  },
  "budgets": { "onTrack": 0, "atRisk": 0, "over": 0, "items": [] },
  "goals": { "active": [], "completionPctAvg": 0 },
  "obligations": { "billsDue7d": [], "subscriptionsMonthly": 0 },
  "behavior": {
    "topCategories": [],
    "topMerchants": [],
    "weekendSpendLift": 0,
    "postPaydayLift": 0
  },
  "health": { "overall": 0, "factors": {} },
  "risk": { "level": "low|medium|high", "reasons": [] }
}
```

**APIs**


| Method | Path                  | Notes                                                |
| ------ | --------------------- | ---------------------------------------------------- |
| `GET`  | `/ai/profile`         | Twin snapshot (+ `stale` flag)                       |
| `POST` | `/ai/profile/refresh` | Force rebuild (rate-limited)                         |
| `GET`  | `/ai/dashboard`       | Hub payload: profile summary + top insights + health |


**UX**

- **Personal CFO** screen: hero snapshot (balance, savings rate, health), “What Twin knows”, last refreshed time, “Refresh”.
- Chat and Coach always show “Based on data as of …”.

---

### 6.2 AI Financial Coach

**Purpose:** Proactive, actionable guidance without waiting for questions.

**Insight object**

```json
{
  "id": "...",
  "type": "overspend|opportunity|risk|win|goal",
  "severity": "high|medium|low",
  "title": "...",
  "body": "...",
  "fact": { "metric": "...", "value": ..., "baseline": ... },
  "action": { "label": "Create budget", "href": "/budgets", "payload": null },
  "evidence": [{ "kind": "transaction|budget|goal", "id": "..." }],
  "status": "active|dismissed|acted",
  "expiresAt": null
}
```

**Triggers (event → coach)**


| Event                    | Producer today           | Coach behavior              |
| ------------------------ | ------------------------ | --------------------------- |
| Expense created/updated  | transactions service     | Category vs avg / budget    |
| Budget threshold         | `budgets/alerts.js`      | Link alert → richer insight |
| Goal progress / complete | goals module             | Celebrate + next goal tip   |
| Bill due / low balance   | jobs/notifications       | Risk insight                |
| Monthly rollover         | AI job                   | Monthly coaching pack       |
| Salary-like income       | heuristic (large income) | Allocation tip              |


**Delivery channels**

1. Insight cards in AI hub + dashboard strip (max 3).
2. Notification `type: ai_coach` (deduped 24–72h like existing `notifyOnce`).
3. Preloaded prompts in Ask My Money (“Why dining is up”).

**Rules**

- Max **3 active high-severity** insights; queue the rest.  
- Never invent merchants or amounts — cite evidence IDs.  
- Soft language; no shaming.

---

### 6.3 AI Life Simulator

**Purpose:** Safe “what if” for life decisions.

**Workflow**

```
Load Twin snapshot
  → deep-clone profile in process memory (no Redis/queue; never mutate DB ledger)
  → apply scenario deltas (income, EMI, expenses, one-time outflow)
  → project N months (default 12–60 depending on scenario)
  → return comparison: baseline vs scenario
```

**Scenario templates (v1)**


| Template            | Key inputs                                                |
| ------------------- | --------------------------------------------------------- |
| Buy car / vehicle   | price, down payment, rate, tenure, fuel/insurance monthly |
| Buy house           | same + rent replaced?                                     |
| Salary change       | new monthly income, effective date                        |
| New loan            | EMI / principal                                           |
| Vacation            | one-time spend                                            |
| Increase SIP        | monthly investment bump                                   |
| Emergency fund push | monthly surplus allocation                                |


**API**

`POST /ai/simulations`

```json
{
  "template": "buy_car",
  "params": { "price": 1500000, "downPayment": 300000, "tenureMonths": 60, "annualRate": 9.5 },
  "horizonMonths": 36
}
```

**Response:** cashflow series, net worth series, health delta, goal delays, plain-language recommendation, optional “best time” window.

**UX**

- Template gallery → sliders → live results (charts reuse reports components).  
- Big disclaimer: **Simulation only — nothing saved**.  
- Secondary CTA: “Create goal from this plan” / “Add loan draft” (user confirms).

**Persistence:** optional `ai_simulations` row for history (inputs + results JSON); never writes to `Transaction` / `Account`.

---

### 6.4 Ask My Money (NLQ)

**Purpose:** Natural-language queries over *real* ledger data.

**Pipeline (anti-hallucination)**

```
User utterance
  → intent + entities (LLM or classifier)
  → tool call only (never free-form SQL from LLM)
  → server executes allowlisted query builders
  → numbers returned as structured facts
  → LLM narrates using ONLY those facts
```

**Allowlisted tools (v1)**


| Tool                 | Maps to                           |
| -------------------- | --------------------------------- |
| `spend_by_category`  | reports categories / tx aggregate |
| `spend_by_merchant`  | title/notes search + group        |
| `cashflow_period`    | reports cashflow                  |
| `list_transactions`  | transactions list filters         |
| `budget_status`      | budgets module                    |
| `goal_status`        | goals module                      |
| `subscription_costs` | subscriptions                     |
| `net_worth`          | dashboard / twin                  |
| `twin_summary`       | `/ai/profile`                     |


**API**

`POST /ai/chat`

```json
{
  "message": "How much did I spend on food last month?",
  "threadId": "optional",
  "client": "web|mobile"
}
```

Response includes `answer`, `facts[]`, `charts?`, `citations[]` (period + filters).

**UX**

- Suggested chips: Food last month · Biggest expense · Subscriptions total · Savings rate.  
- Show fact pills under the answer (“₹12,400 · Jul 2026 · category Food”).  
- If confidence low: “I need a category or date range” instead of guessing.  
- Replace current stub chat in web + mobile.

---

### 6.5 Spending Pattern Detection

**Purpose:** Behavioral analytics, mostly deterministic (fast, cheap, explainable).

**Detectors (v1)**


| Pattern                 | Signal                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| Top category / merchant | spend share (merchant ≈ clustered `title` / notes — no merchant entity) |
| Weekend vs weekday lift | Sat–Sun vs Mon–Fri avg (by `Transaction.date` calendar day)             |
| Post-payday spike       | +0–5 days after largest income                                          |
| Category MoM growth     | % change                                                                |
| Subscription creep      | active sub sum vs 90d ago                                               |
| Cashflow volatility     | stdev of monthly net                                                    |


**Deferred (needs schema change):** night-owl / hour-of-day patterns. `Transaction.date` is **calendar-day only** (no spend time); do not use `createdAt` as a proxy for spend hour.

**Cadence**


| Job                                             | Scope                         |
| ----------------------------------------------- | ----------------------------- |
| Daily (with existing cron or dedicated AI cron) | light detectors + coach hooks |
| Weekly                                          | weekend/payday patterns       |
| Monthly                                         | MoM growth, replay seed       |
| On-demand                                       | `POST /ai/patterns/refresh`   |


**API:** `GET /ai/patterns?period=month`  
**UX:** Pattern cards + mini charts; tap opens filtered Transactions.

---

### 6.6 Financial Health Score (v2)

**Replace** single `50 + savingRate` with weighted factors (still deterministic).


| Factor             | Weight (v1 proposal) | Inputs                     |
| ------------------ | -------------------- | -------------------------- |
| Savings rate       | 20%                  | income vs expense          |
| Emergency fund     | 15%                  | liquid / monthly expense   |
| Debt burden        | 15%                  | EMI / income, debt/assets  |
| Investment ratio   | 10%                  | invested / net worth       |
| Budget discipline  | 15%                  | % budgets under alert      |
| Cashflow stability | 10%                  | variance of last 6 months  |
| Goal progress      | 10%                  | avg % to target (active)   |
| Income stability   | 5%                   | income presence regularity |


**API:** `GET /ai/health-score`  
Also embed in Twin + dashboard (backward compatible: keep `dashboard.healthScore` as overall).

**UX**

- Radial / factor bars (reuse chart libs).  
- Each factor: score, one sentence “why”, one CTA (“Add ₹X to emergency”).  
- History sparkline from `ai_health_scores` monthly snapshots.

---

### 6.7 Goal Recommendation Engine

**Purpose:** Suggest realistic goals from surplus and life stage signals.

**Logic (deterministic first)**

```
surplus ≈ max(0, monthlyIncome - monthlyExpense - EMIs - subMinimum)
safeContribute ≈ surplus * 0.4..0.7 (risk-adjusted)
templates ranked by: emergency gap → high-interest debt payoff → short goals → long goals
```

**Output card**

- Title, target amount, monthly contribution, ETA, confidence (0–100), priority, rationale.

**API:** `GET /ai/recommendations/goals`  
**Action:** `POST /goals` with prefilled body (user confirms in UI).

**UX:** Goal Planner list → “Add this goal” opens existing Goals modal prefilled.

---

### 6.8 Money Replay

**Purpose:** Turn a period into a short story + timeline.

**Build**

1. Fetch period transactions + income + key events (salary, rent, EMI, investments).
2. Cluster by week / major categories.
3. Deterministic outline (stats).
4. LLM writes narrative from outline only.
5. Store in `ai_monthly_replays` for instant reload.

**API:** `GET /ai/replay?period=2026-07` | `?from=&to=`

**UX**

- Vertical timeline (salary → rent → … → ending balance).  
- Story paragraph + highlight chips (best save day, biggest purchase).  
- Share card later (“Wrapped” style) — v1.1.

---

## 7. Processing pipeline

### 7.1 Online (request path)

No Redis/BullMQ required for v1. Invalidation is a **DB flag** on `AiProfile`; coach may run inline (rate-limited) or wait for the next AI job tick.

```
Mutation (tx/budget/goal/…)
  → existing module logic (source of truth)
  → side effects today (budget alert, goal notify)
  → set AiProfile.stale = true for userId
  → optionally coach.evaluate(userId, event) inline (rate-limited; else skip until job)
```

Ask My Money / Simulator / Replay **read** Twin (rebuild if stale, same process).

### 7.2 Offline / jobs (batch)

Extend jobs runner (same advisory lock pattern):


| Task                | Schedule suggestion             |
| ------------------- | ------------------------------- |
| `ai:twinRefresh`    | nightly + on stale              |
| `ai:patterns`       | daily light / weekly deep       |
| `ai:healthSnapshot` | monthly + on twin refresh       |
| `ai:coachDigest`    | daily                           |
| `ai:replayDraft`    | 1st of month for previous month |


Config: `AI_JOBS=inline|off` alongside `JOBS_MODE`.

### 7.3 End-to-end after a transaction

```
Transaction created
  → balance + budget alert (existing)
  → mark Twin stale
  → pattern hooks (category spend delta)
  → coach may emit insight (rate-limited)
  → clients refresh dashboard / AI overview
```

---

## 8. Data model (Prisma additions)

Existing entities stay untouched as SoT. New models store **derived AI artifacts only**.

```prisma
model AiProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  version   Int      @default(1)
  profile   String   // JSON
  stale     Boolean  @default(true)
  builtAt   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(...)
}

model AiInsight {
  id        String   @id @default(cuid())
  userId    String
  type      String
  severity  String
  title     String
  body      String
  fact      String   @default("{}")
  action    String   @default("{}")
  evidence  String   @default("[]")
  status    String   @default("active")
  expiresAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId, status, createdAt])
}

model AiPattern {
  id        String   @id @default(cuid())
  userId    String
  key       String   // e.g. weekend_lift
  period    String
  payload   String   // JSON metrics
  summary   String
  createdAt DateTime @default(now())
  @@unique([userId, key, period])
}

model AiHealthScore {
  id        String   @id @default(cuid())
  userId    String
  asOf      DateTime
  overall   Int
  factors   String   // JSON
  createdAt DateTime @default(now())
  @@index([userId, asOf])
}

model AiGoalRecommendation {
  id           String   @id @default(cuid())
  userId       String
  title        String
  targetAmount Float
  monthly      Float
  etaMonths    Int
  confidence   Int
  priority     Int
  rationale    String
  status       String   @default("suggested") // suggested|accepted|dismissed
  createdAt    DateTime @default(now())
  @@index([userId, status])
}

model AiSimulation {
  id        String   @id @default(cuid())
  userId    String
  template  String
  params    String
  result    String
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

model AiChatThread {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  AiChatMessage[]
}

model AiChatMessage {
  id        String   @id @default(cuid())
  threadId  String
  role      String   // user|assistant|tool
  content   String
  facts     String   @default("[]")
  createdAt DateTime @default(now())
  thread    AiChatThread @relation(...)
}

model AiMonthlyReplay {
  id        String   @id @default(cuid())
  userId    String
  period    String   // YYYY-MM
  timeline  String
  summary   String
  stats     String
  createdAt DateTime @default(now())
  @@unique([userId, period])
}
```

---

## 9. API surface (v1)

Base: `/api/v1/ai` (extend existing mount).


| Method | Path                        | Auth | Description                                  |
| ------ | --------------------------- | ---- | -------------------------------------------- |
| `GET`  | `/ai/dashboard`             | ✓    | Hub aggregate                                |
| `GET`  | `/ai/profile`               | ✓    | Twin                                         |
| `POST` | `/ai/profile/refresh`       | ✓    | Rebuild twin                                 |
| `POST` | `/ai/chat`                  | ✓    | Ask My Money                                 |
| `GET`  | `/ai/chat/threads`          | ✓    | History                                      |
| `GET`  | `/ai/health-score`          | ✓    | Factors + overall                            |
| `GET`  | `/ai/patterns`              | ✓    | Detected patterns                            |
| `GET`  | `/ai/insights`              | ✓    | Coach feed                                   |
| `POST` | `/ai/insights/:id/dismiss`  | ✓    | Dismiss                                      |
| `POST` | `/ai/insights/:id/act`      | ✓    | Mark acted                                   |
| `GET`  | `/ai/recommendations/goals` | ✓    | Goal ideas                                   |
| `POST` | `/ai/simulations`           | ✓    | Life simulator                               |
| `GET`  | `/ai/simulations`           | ✓    | Past sims                                    |
| `GET`  | `/ai/replay`                | ✓    | Money replay                                 |
| `GET`  | `/insights/smart`           | ✓    | Alias → insights (compat with SYSTEM_DESIGN) |


**Deprecate (soft):** stub-only behavior of current `GET /ai/suggestions` — map to insights or remove after clients migrate.

---

## 10. Server module layout

```
server/src/modules/ai/
  twin/          builder, cache, schema
  coach/         insight generators
  patterns/      detectors
  health/        scoring
  goals/         recommendations
  simulator/     scenario engine
  replay/        timeline + narrative
  chat/          tools + LLM orchestration
  routes.js      aggregates sub-routes
  service.js
  repository.js
```

Jobs:

```
server/src/jobs/tasks/ai.js   // twin, patterns, health, coach digest, replay draft
```

LLM adapter (as in SYSTEM_DESIGN):

```
server/src/lib/ai/
  provider.js      // Gemini (@google/generative-ai) behind interface
  prompts.js
  tools.js         // allowlisted tool defs
```

Env:

```
AI_PROVIDER=gemini|none
AI_API_KEY=                 # Gemini API key (Google AI Studio / Vertex)
AI_MODEL=gemini-2.0-flash   # or gemini-1.5-flash / gemini-1.5-pro
AI_ENABLED=true
AI_JOBS=inline|off
```

Default provider is **Gemini**. The adapter interface stays the same so a future provider can be added without changing routes.

When `AI_PROVIDER=none`, chat still answers via **template narration over tool facts** (degraded but truthful).

---

## 11. Client & mobile UX mapping


| Surface      | Web                                  | Mobile            |
| ------------ | ------------------------------------ | ----------------- |
| Hub Overview | `/ai` overview / new `/intelligence` | AI tab home       |
| Ask My Money | Chat panel                           | AI tab composer   |
| Health       | Health page / dashboard widget       | Card + detail     |
| Patterns     | Patterns page                        | List + charts     |
| Coach        | Insights feed                        | Push + feed       |
| Simulator    | Full-page wizard                     | Multi-step modal  |
| Replay       | Story view                           | Vertical timeline |
| Goal planner | Cards → Goals modal                  | Same              |


**Dashboard upgrade**

- Keep existing metrics.  
- Replace thin `buildInsights()` with `GET /ai/insights?limit=3`.  
- Show Twin health overall (same number as Health page).

---

## 12. AI rules (product + engineering)

1. Never write ledger data without an explicit user action in a finance module API.
2. Never invent transactions, balances, or dates.
3. Every recommendation includes **fact** + **rationale** + optional **action**.
4. Label projections clearly.
5. Simulations are ephemeral unless user saves a draft goal/loan.
6. Personalize with Twin; don’t leak cross-user data.
7. Log tool calls for support/debug (no raw card numbers in logs).
8. Respect notification prefs (`notificationPrefs.aiCoach`).
9. Rate-limit LLM and simulation endpoints per user.
10. Soft-fail: if LLM down, return facts + canned narrative.

---

## 13. Phased delivery

### Phase A — Twin foundation (1–2 weeks) ✅ implemented

- Prisma AI tables (profile, insights, health, patterns).  
- Twin builder + `GET /ai/profile` + `/ai/dashboard`.  
- Health score v2 wired into dashboard.  
- Web/mobile: Personal CFO + Health screens.

### Phase B — Coach + Patterns (1–2 weeks) ✅ implemented

- Pattern detectors + job hooks.  
- Coach insights + dismiss/act.  
- Replace client-only Smart Insights.  
- Notifications `ai_coach`.

### Phase C — Ask My Money (1–2 weeks) ✅ implemented

- Tool-calling chat (Gemini plan → allowlisted tools → narrate).  
- Thread history (`AiChatThread` / `AiChatMessage`).  
- Retire stub tips UX (web + mobile fact pills + suggestion chips).

### Phase D — Goals + Replay + Simulator (2–3 weeks) ✅ implemented

- Goal recommendations → create goal (`GET/POST /ai/recommendations/goals*`).  
- Monthly Money Replay (`GET /ai/replay`).  
- Life Simulator templates + charts (`POST/GET /ai/simulations`).  
- Web + mobile: Goal Planner, Replay, Simulator screens.

### Phase E — Polish

- Wrapped/share cards, more templates, AA/SMS as optional Twin inputs later.

---

## 14. Success metrics


| Metric                        | Target (directional)                         |
| ----------------------------- | -------------------------------------------- |
| Twin freshness                | < 15 min after material mutation             |
| Ask My Money factual accuracy | ≥ 95% on eval set of canned questions        |
| Coach dismiss rate            | < 40% (insights feel useful)                 |
| Simulator sessions / WAUs     | Growing engagement without support tickets   |
| Health score understanding    | Users open factor detail ≥ 30% of hub visits |
| Goal accept rate              | ≥ 15% of shown recommendations               |


Qualitative: users describe FinanceOS as an **advisor**, not only a ledger.

---

## 15. Risks & mitigations


| Risk              | Mitigation                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| LLM hallucination | Tool-only numbers; refuse without facts                                   |
| Cost              | Flash model (Gemini); cache Twin; batch jobs; `AI_PROVIDER=none` fallback |
| Insight spam      | Caps, severity, prefs, dedupe                                             |
| Cold start        | Warming-up UX; don’t score harshly with < 30 days data                    |
| Mobile parity     | Shared APIs; no web-only intelligence                                     |
| Scope creep       | Phases A→E; simulator last among chat/health                              |


---

## 16. Testing strategy

Extend `TEST_FLOWS.md`:

- Twin rebuild after tx create.  
- Health factors move when expense spikes.  
- Ask My Money: “food last month” returns sum matching reports.  
- Coach insight on budget breach.  
- Simulator does not change account balances.  
- Replay for month with seed data.  
- Dismiss insight removes from feed.  
- `AI_PROVIDER=none` still returns structured answers.

Add server unit tests for health weights, pattern math, scenario EMI math.

---

## 17. Long-term vision

```
Expense Tracker
  → Personal Finance Manager          ← you are here
  → AI Financial Assistant            ← Phases A–C
  → AI Financial Operating System     ← Phases D–E + AA/SMS inputs
  → Personal CFO for every user       ← Twin compounds over years
```

The Financial Twin remains the single intelligence layer: every new AI feature is another **lens** on the same profile, keeping UX coherent and engineering maintainable.

---

## 18. Decision log (v1.0)


| Decision           | Choice                                | Why                                                 |
| ------------------ | ------------------------------------- | --------------------------------------------------- |
| Architecture       | Single Twin + feature lenses          | Avoid 8 siloed AI features                          |
| LLM provider       | Gemini (Google AI)                    | Project uses Gemini API key; Flash for cost         |
| Scoring            | Deterministic multi-factor            | Explainable, cheap, testable                        |
| Chat               | Tool-calling over raw SQL gen         | Safety                                              |
| Coach storage      | `AiInsight` table                     | Feed + notifications + dismiss state                |
| Simulator          | In-memory clone only (no Redis)       | Matches current infra; no queue dependency          |
| Twin invalidate    | `AiProfile.stale` flag + jobs rebuild | Same pattern as existing node-cron + advisory locks |
| Night-owl patterns | Deferred                              | `Transaction.date` has no time-of-day               |
| Doc location       | `server/AI_DESIGN.md`                 | Next to `SYSTEM_DESIGN.md`                          |


---

## 19. Next implementation step

When ready to build, start **Phase A**: Prisma models + Twin builder + `GET /ai/profile` + `GET /ai/health-score` + hub Overview on web and mobile — then migrate dashboard health to the new score while keeping the same response field for compatibility.