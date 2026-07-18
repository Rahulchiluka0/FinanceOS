# FinanceOS — Backend System Design

> Source of truth for implementing the `server/` API against  
> `FinanceOS_Complete_Feature_List.docx` and the existing `client/` React UI.

---

## 1. Product overview

**FinanceOS** is an AI-powered personal finance web app. Users manage money across accounts, transactions, budgets, goals, bills, loans, investments, and more — with reports, notifications, and AI-assisted insights.

| Layer | Location | Role today | Target |
|-------|----------|------------|--------|
| Frontend | `client/` (React + Vite) | Full UI + in-memory `DataContext` mock | Talk to REST API via JWT |
| Backend | `server/` (to build) | Placeholder | Node.js + Express API + DB |
| Spec | Feature list doc | MVP → v2 → v3 roadmap | Guides module priority |

**Roadmap alignment**

| Phase | Scope |
|-------|--------|
| **MVP** | Auth, Dashboard aggregates, Accounts, Categories, Transactions, Budgets, Goals, Recurring, Reports/Charts, Search, CSV Import/Export, Settings |
| **v2** | AI, Loans/EMI, Investments, Bills, Subscriptions, Notifications, Smart Insights, Tags, Calendar, Multi-currency |
| **v3** | Bank/UPI sync, OCR, Voice, Family accounts, Tax/GST, Mobile, Open Banking |

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  AuthContext │ DataContext → becomes API client (fetch/axios)   │
│  Pages map 1:1 to modules below                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + JWT (Bearer)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Express)                      │
│  CORS · Helmet · Rate limit · Request validation · Error layer  │
└───────┬──────────────┬──────────────┬──────────────┬────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   Auth Module    Core Finance    Insights/AI    Jobs/Workers
   (users,        (accounts,      (reports,      (recurring
    sessions,      tx, budgets…)   notifications,  auto-create,
    password)                       AI stubs)       bill reminders)
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Database       │
                    │  (PostgreSQL    │
                    │   recommended)  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │ Redis (optional)│  sessions, queues, rates cache
                    └─────────────────┘
```

**Recommended stack**

| Concern | Choice | Why |
|---------|--------|-----|
| Runtime | Node.js (ESM) | Matches project (`Node-JS-Practical`) |
| Framework | Express | Simple, fits practical coursework |
| DB | PostgreSQL + Prisma (or Sequelize) | Relational money data, FKs, aggregates |
| Auth | JWT access + refresh (or httpOnly cookie) | Matches SPA |
| Password | bcrypt / argon2 | Spec: password hashing |
| Validation | Zod or Joi | Align request bodies with frontend forms |
| Jobs | node-cron or BullMQ | Recurring tx, bill/subscription reminders |
| Files | Local/`uploads` or S3 | Receipts, import files, backups |
| AI (v2) | Provider adapter (OpenAI/etc.) behind interface | Swap without touching routes |

**Alternative for faster local start:** SQLite (`better-sqlite3` / Prisma SQLite) — same schema, zero Docker. Migrate to Postgres later.

---

## 3. Frontend ↔ backend mapping

Every client route should eventually call matching API resources. Today mock methods live in `client/src/context/DataContext.jsx`.

| Client route / page | Frontend mock ops | Backend module | Primary APIs |
|---------------------|-------------------|----------------|--------------|
| `/login`, `/register`, `/forgot-password` | `AuthContext` | Auth | `POST /auth/*` |
| `/settings` | profile prefs | Users / Settings | `GET/PATCH /users/me`, `POST /users/me/password` |
| `/dashboard` | aggregates from lists | Dashboard | `GET /dashboard` |
| `/accounts` | save, archive, transfer | Accounts | `/accounts`, `/accounts/transfer` |
| `/transactions` | CRUD, bulk, favorite, duplicate | Transactions | `/transactions` |
| `/categories` | save, archive | Categories | `/categories` |
| `/budgets` | save, delete | Budgets | `/budgets` |
| `/goals` | save, adjust, delete | Goals | `/goals`, `/goals/:id/deposit\|withdraw` |
| `/recurring` | save, status | Recurring | `/recurring` |
| `/tags` | CRUD | Tags | `/tags` |
| `/bills` | save, toggle paid | Bills | `/bills` |
| `/subscriptions` | save, status | Subscriptions | `/subscriptions` |
| `/loans` | CRUD | Loans | `/loans` |
| `/investments` | CRUD | Investments | `/investments` |
| `/calendar` | reads tx+bills+recurring | Calendar (compose) | `GET /calendar?month=` |
| `/reports` | charts + export | Reports | `GET /reports/*`, `GET /exports/*` |
| `/insights` | smart metrics | Insights | `GET /insights/smart` |
| `/ai` | chat shell | AI | `POST /ai/chat`, `GET /ai/suggestions` |
| `/notifications` | mark read | Notifications | `/notifications` |
| `/currencies` | rates + convert | FX | `GET /fx/rates`, `POST /fx/convert` |
| `/import-export` | file parse / download | ImportExport | `POST /import/*`, `GET /export/*`, backup |
| `/search` | client filter | Search | `GET /search?q=` |

**Migration rule:** Replace `DataContext` mutations with API calls; keep the same page UX. Prefer a thin `client/src/api/` layer mirroring modules above.

---

## 4. Module catalog & responsibilities

### 4.1 Auth & User Management

**Owns:** registration, login, logout, forgot/reset password, change password, sessions, profile.

**Entities:** `User`, `Session` / refresh tokens, `PasswordResetToken`.

**Rules**
- Email unique; password hashed (never store plain text).
- JWT carries `userId` (+ optional `sessionId`).
- Profile fields: `name`, `email`, `avatarUrl`, `currency`, `timezone`, `dateFormat`, `theme`.
- All other modules are **scoped by `userId`** (multi-tenant by user).

**Interconnects**
- Every protected route → Auth middleware.
- Settings UI → User profile.
- Notifications prefs → User settings JSON.
- Backup/restore → user-owned dataset.

---

### 4.2 Accounts

**Owns:** Cash, Bank, Wallet, Credit Card, UPI; opening/current balance; archive; transfers.

**Entities:** `Account`.

**Rules**
- `balance` is source of truth for liquid cash; credit cards may be negative.
- **Transfer** = atomic debit A + credit B + optional linked `Transaction` type `transfer`.
- Archive hides from pickers; historical tx remain.

**Interconnects**
- Transactions / Bills / Subscriptions reference `accountId`.
- Dashboard total balance = sum of non-archived accounts (define credit-card treatment).
- Reports: account breakdown.
- Transfer updates Accounts + Transactions together (transactional DB write).

---

### 4.3 Categories

**Owns:** income/expense taxonomy, parent/subcategory, color, icon, archive.

**Entities:** `Category` (self-FK `parentId`).

**Interconnects**
- Transactions, Budgets, Reports, Smart Insights all group by category.
- Soft-archive: block new tx on archived; keep old references.

---

### 4.4 Transactions (core ledger)

**Owns:** income / expense / transfer; CRUD; duplicate; favorite; notes; receipt; tags; bulk ops; search/filters.

**Entities:** `Transaction`, `TransactionTag` (M2N), optional `Receipt`.

**Rules**
- Creating/updating/deleting a transaction **must update account balances** (unless “adjustment only”).
- Expense decreases account; income increases; transfer moves between accounts.
- Amounts stored in **minor units** (paise) or `DECIMAL(14,2)` — pick one and stick to it. Recommend `DECIMAL(14,2)` + currency code for MVP.

**Interconnects**
- Accounts (balance), Categories, Tags.
- Budgets: spent = sum of expenses in period for category.
- Goals: optional “deposit from transaction”.
- Calendar / Search / Reports / Dashboard / Insights / Import all read this table heavily.
- Recurring job **creates** Transactions.

---

### 4.5 Tags

**Owns:** CRUD tags; attach many tags per transaction; filter; light analytics.

**Entities:** `Tag`, `TransactionTag`.

**Interconnects**
- Transactions UI chip selector.
- Search/filters by tag.
- Tag analytics = aggregate tx by tag for user.

---

### 4.6 Budgets

**Owns:** weekly/monthly/yearly category limits; progress; alerts; history.

**Entities:** `Budget`, optional `BudgetSnapshot` (history).

**Rules**
- `spent` can be **computed** from transactions (preferred) rather than denormalized — or denormalize + recompute on tx write.
- Alert when `spent/limit >= alertAt%` → Notification (`type: budget`).

**Interconnects**
- Categories, Transactions, Notifications, Reports, Dashboard budget progress, AI suggestions.

---

### 4.7 Savings Goals

**Owns:** target, deadline, progress, deposit/withdraw, completion.

**Entities:** `Goal`, `GoalLedger` (optional audit of deposits/withdrawals).

**Rules**
- Deposit/withdraw adjust `current`; when `current >= target` → `completed` + celebration flag + Notification.
- Optionally link deposit to an Account debit.

**Interconnects**
- Accounts (optional), Notifications, Dashboard, Insights (goal prediction), AI saving tips.

---

### 4.8 Recurring Transactions

**Owns:** schedule (daily/weekly/monthly/yearly/custom); pause/resume/skip/end; auto-create.

**Entities:** `RecurringRule`.

**Rules**
- Worker runs daily: for each `active` rule where `nextDate <= today`, create Transaction, advance `nextDate`, emit Notification if configured.
- Pause: skip worker. Skip: push nextDate one cycle. End: status `ended`.

**Interconnects**
- Transactions (creates rows), Accounts/Categories, Calendar, Notifications, Dashboard “upcoming recurring”.

---

### 4.9 Bills

**Owns:** rent/utilities/insurance/credit-card dues; paid/unpaid; due dates.

**Entities:** `Bill`.

**Rules**
- Marking **paid** may create an expense Transaction and debit Account (recommended for consistency).
- Due soon / overdue → Notifications.

**Interconnects**
- Accounts, Transactions (optional), Calendar, Notifications, Dashboard upcoming bills.

---

### 4.10 Subscriptions

**Owns:** recurring SaaS/service costs; renewal dates; monthly/yearly rollup; pause.

**Entities:** `Subscription`.

**Rules**
- Similar to Recurring but product-focused (name, cycle, renewal).
- Renewal reminder Notifications.
- Can mirror into Recurring or stay separate — **recommend separate entity**, optional link to `recurringId`.

**Interconnects**
- Notifications, Reports (subscription spend), Smart Insights / AI (“pause Adobe…”).

---

### 4.11 Loans & EMI

**Owns:** principal, rate, EMI, remaining, tenure, paid months, next due, reminders, projection.

**Entities:** `Loan`, optional `EmiSchedule` (generated rows).

**Rules**
- On EMI payment date: reduce `remaining`, increment `paidMonths`, optional Transaction.
- Projection: remaining schedule from rate + EMI formula.
- Reminder Notifications before `nextDue`.

**Interconnects**
- Accounts/Transactions (payments), Notifications, Dashboard net worth (liabilities), Reports.

---

### 4.12 Investments

**Owns:** stocks, MF, FDs, gold, crypto, real estate; portfolio value; P/L.

**Entities:** `Investment`.

**Rules**
- `pl = currentValue - invested` (MVP manual values; v3 market price sync).
- Portfolio totals for Dashboard net worth.

**Interconnects**
- Dashboard net worth, Reports, Smart Insights (net worth growth).

---

### 4.13 Dashboard

**Owns:** aggregated read model — not a table.

**Computes**
- Total balance, monthly income/expense, net savings, net worth (accounts + investments − loans), health score, recent tx, budget progress, goals, upcoming bills/recurring, AI insight blurbs.

**Interconnects**
- Reads Accounts, Transactions, Budgets, Goals, Bills, Recurring, Investments, Loans, Insights/AI.

**API:** `GET /dashboard` (single payload matching frontend hero + widgets).

---

### 4.14 Reports & Charts

**Owns:** income vs expense, category/account reports, trends, cash flow, savings, budget/goal progress, exports.

**Interconnects**
- Pure query layer over Transactions (+ Budgets/Goals/Accounts).
- Export module shares same queries → CSV/Excel/PDF.

**Charts to support (API data shapes)**
- Area/line: monthly income vs expense.
- Pie/donut: category spend.
- Bar: category or month comparison.
- Heatmap: **future**.

---

### 4.15 Calendar

**Owns:** composed month view of transactions + bills + recurring by date.

**API:** `GET /calendar?year=&month=` → `{ "2026-07-07": { transactions, bills, recurring } }`.

**Interconnects**
- Transactions, Bills, Recurring (no own table required).

---

### 4.16 Search & Filters

**Owns:** global search across transactions, accounts, bills, goals (extendable); advanced filters; saved filters (stretch).

**Entities:** optional `SavedFilter`.

**Interconnects**
- Full-text or `ILIKE` across multiple tables; respects `userId`.

---

### 4.17 Import & Export / Backup

**Owns:** CSV/Excel/JSON import; export; backup/restore.

**Rules**
- Import runs in a DB transaction; map rows → Accounts/Categories/Transactions.
- Backup = encrypted or plain JSON dump of user data (MVP plain + auth required).
- Restore replaces or merges (define policy: **merge** safer for MVP).

**Interconnects**
- All core finance tables; Notifications on completion.

---

### 4.18 Notifications

**Owns:** budget alerts, bills, goals, low balance, recurring reminders; read/unread.

**Entities:** `Notification`.

**Producers (event-driven)**
- Budget threshold crossed.
- Bill due in N days / overdue.
- Goal completed / milestone.
- Account balance &lt; threshold.
- Recurring upcoming / created.
- Loan EMI due.
- Subscription renewal.

**Consumers:** Notifications page, topbar badge (`unreadCount`).

---

### 4.19 AI Features (v2)

**Owns:** advisor insights, monthly summary, budget/saving suggestions, health score, anomaly detection, smart categorization, chat.

**Design**
- `AiService` interface: `suggestCategories(tx)`, `chat(messages)`, `monthlySummary(userId)`, `detectAnomalies(userId)`.
- MVP/v2 stub: rule-based heuristics (same as current frontend canned tips).
- Later: LLM provider; never send secrets; send aggregated context only.

**Interconnects**
- Reads Transactions/Budgets/Goals; writes Notifications; optional auto-set Category on import.

---

### 4.20 Smart Insights (v2)

**Owns:** top spending, largest expense, MoM comparison, saving rate, income/expense growth, cash burn, net worth growth, goal prediction.

**API:** `GET /insights/smart` — computed metrics for UI cards.

**Interconnects**
- Same analytical base as Reports; can share query helpers / materialized views later.

---

### 4.21 Multi-Currency

**Owns:** user base currency; FX rates; conversion.

**Entities:** `ExchangeRate` (or external API cache in Redis).

**Rules**
- Store tx in account currency or always convert to user base — **recommend:** account has `currency`; reports convert to user preference using latest rates.
- MVP: static/seeded rates table (matches frontend `exchangeRates`).

---

### 4.22 Security

**Owns:** hashing, secure auth, sessions, audit logs, encryption at rest (backups), rate limits.

**Entities:** `AuditLog`.

**Rules**
- Log sensitive actions: login, password change, transfer, import, restore, delete account data.
- HTTPS in production; helmet; CORS allow `client` origin only.
- Soft-delete vs hard-delete policy documented per entity.

---

### 4.23 Settings

**Owns:** facade over User profile + notification preferences + backup triggers.

**Interconnects**
- User, Notifications prefs, ImportExport backup endpoints.

---

### 4.24 PWA / Platform (mostly client)

**Backend support:** cacheable GETs, `ETag`, offline sync later (v3).  
Installable/offline are primarily frontend service-worker work.

---

## 5. Domain interconnection map

```
                         ┌──────────┐
                         │   User   │
                         └────┬─────┘
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
      ┌─────────┐       ┌──────────┐      ┌────────────┐
      │ Account │◄─────►│ Category │      │    Tag     │
      └────┬────┘       └────┬─────┘      └──────┬─────┘
           │                 │                   │
           │         ┌───────┴───────┐           │
           └────────►│ Transaction   │◄──────────┘
                     └───────┬───────┘
           ┌─────────┬───────┼────────┬──────────┐
           ▼         ▼       ▼        ▼          ▼
       ┌───────┐ ┌──────┐ ┌─────┐ ┌────────┐ ┌──────────┐
       │Budget │ │Goal* │ │Bill │ │Recurring│ │Reports/  │
       └───────┘ └──────┘ └─────┘ └────────┘ │Insights  │
           │         │       │        │      └──────────┘
           └─────────┴───────┴────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Notification │
                  └──────────────┘

  Loan ──► (EMI payment) ──► Transaction + Account
  Subscription ──► reminders ──► Notification (+ optional Recurring)
  Investment ──► Net worth (Dashboard)
  AI ──► reads Transaction/Budget/Goal ──► suggestions / Notification
```

`*` Goal deposits may optionally create Account debits / GoalLedger entries.

---

## 6. Core data model (logical schema)

> IDs: UUID preferred. All business tables include `user_id`, `created_at`, `updated_at`.

### Users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | string | |
| email | string | unique |
| password_hash | string | |
| avatar_url | string? | |
| currency | char(3) | default INR |
| timezone | string | |
| date_format | string | |
| theme | string | light/system |
| notification_prefs | JSON | toggles |
| created_at / updated_at | timestamptz | |

### Accounts
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | FK |
| name | string | |
| type | enum | cash, bank, wallet, credit_card, upi |
| currency | char(3) | |
| opening_balance | decimal | |
| balance | decimal | |
| color | string | |
| archived | bool | |
| icon | string? | |

### Categories
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | |
| name | string | |
| type | enum | income, expense |
| parent_id | UUID? | self FK |
| color | string | |
| icon | string | |
| archived | bool | |

### Transactions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | |
| user_id | UUID | |
| account_id | UUID | FK |
| to_account_id | UUID? | transfers |
| category_id | UUID? | |
| type | enum | income, expense, transfer |
| title | string | |
| amount | decimal | always &gt; 0; sign via type |
| date | date | |
| notes | text? | |
| favorite | bool | |
| receipt_url | string? | |
| recurring_id | UUID? | if auto-created |

### Tags / Transaction_Tags
Standard M2N.

### Budgets
`category_id`, `period` (weekly|monthly|yearly), `limit_amount`, `alert_at` (0–100), `start_date` (period anchor).

### Goals
`name`, `target_amount`, `current_amount`, `deadline`, `color`, `completed`.

### Recurring
`title`, `type`, `amount`, `account_id`, `category_id`, `frequency`, `interval` (custom), `next_date`, `status` (active|paused|ended), `end_date?`.

### Bills
`title`, `category` (rent|utilities|…), `amount`, `due_date`, `status` (paid|unpaid), `account_id`.

### Subscriptions
`name`, `amount`, `cycle` (monthly|yearly), `next_renewal`, `status`.

### Loans
`name`, `principal`, `remaining`, `interest_rate`, `emi`, `next_due`, `tenure_months`, `paid_months`.

### Investments
`name`, `type` (stocks|mf|fd|gold|crypto|real_estate), `invested`, `current_value`.

### Notifications
`type`, `title`, `body`, `read`, `meta` JSON, `created_at`.

### Audit_Logs
`action`, `entity`, `entity_id`, `ip`, `meta`, `created_at`.

### Exchange_Rates
`code`, `rate_to_base`, `as_of`.

---

## 7. Critical business flows

### 7.1 Create expense transaction
1. Validate account + category belong to user.
2. Insert Transaction.
3. `account.balance -= amount`.
4. Recompute budget spent for category/period; if over alert → Notification.
5. Low balance check → Notification.
6. Audit log.

### 7.2 Account transfer
1. Begin DB transaction.
2. Validate from ≠ to; sufficient funds (policy for credit cards).
3. Update both balances.
4. Insert Transaction `type=transfer` (and optionally mirrored leg).
5. Commit; audit.

### 7.3 Recurring auto-create (job)
1. Find due active rules.
2. Create Transaction(s) + balance updates (reuse 7.1/income path).
3. Advance `next_date`.
4. Notify user.

### 7.4 Mark bill paid
1. Set bill `paid`.
2. Optionally create expense Transaction + balance update.
3. Clear related reminder notifications.

### 7.5 Goal deposit
1. Increase `current_amount`.
2. Optional account debit + GoalLedger.
3. If completed → flag + Notification.

### 7.6 Dashboard load
1. Parallel queries / one SQL with CTEs.
2. Return DTO shaped for frontend widgets (avoid N+1 from client).

---

## 8. API design conventions

**Base URL:** `http://localhost:5000/api/v1`

**Auth header:** `Authorization: Bearer <accessToken>`

**Response envelope**
```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100 },
  "error": null
}
```

**Errors**
```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }
}
```

### Route map (MVP → v2)

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/refresh

GET    /users/me
PATCH  /users/me
POST   /users/me/password
POST   /users/me/avatar

GET    /dashboard

GET    /accounts
POST   /accounts
PATCH  /accounts/:id
POST   /accounts/:id/archive
POST   /accounts/transfer

GET    /categories
POST   /categories
PATCH  /categories/:id
POST   /categories/:id/archive

GET    /transactions
POST   /transactions
PATCH  /transactions/:id
DELETE /transactions/:id
POST   /transactions/bulk-delete
POST   /transactions/:id/duplicate
POST   /transactions/:id/favorite

GET    /tags
POST   /tags
PATCH  /tags/:id
DELETE /tags/:id

GET    /budgets
POST   /budgets
PATCH  /budgets/:id
DELETE /budgets/:id

GET    /goals
POST   /goals
PATCH  /goals/:id
DELETE /goals/:id
POST   /goals/:id/deposit
POST   /goals/:id/withdraw

GET    /recurring
POST   /recurring
PATCH  /recurring/:id
POST   /recurring/:id/pause|resume|skip|end

GET    /bills
POST   /bills
PATCH  /bills/:id
POST   /bills/:id/pay
DELETE /bills/:id

GET    /subscriptions
POST   /subscriptions
PATCH  /subscriptions/:id
DELETE /subscriptions/:id

GET    /loans
POST   /loans
PATCH  /loans/:id
DELETE /loans/:id
GET    /loans/:id/schedule

GET    /investments
POST   /investments
PATCH  /investments/:id
DELETE /investments/:id

GET    /calendar
GET    /search
GET    /reports/overview
GET    /reports/cashflow
GET    /reports/categories
GET    /exports/csv
GET    /exports/excel
GET    /exports/pdf

POST   /import/csv
POST   /import/json
GET    /backup
POST   /backup/restore

GET    /notifications
POST   /notifications/read-all
PATCH  /notifications/:id/read

GET    /insights/smart
GET    /ai/suggestions
POST   /ai/chat

GET    /fx/rates
POST   /fx/convert

GET    /health
```

---

## 9. Suggested server folder structure

```
server/
├── SYSTEM_DESIGN.md          ← this file
├── README.md
├── package.json
├── .env.example
├── prisma/                   # or src/db/
│   └── schema.prisma
├── src/
│   ├── index.js              # boot
│   ├── app.js                # express app
│   ├── config/
│   ├── middleware/           # auth, validate, error, rateLimit
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── accounts/
│   │   ├── categories/
│   │   ├── transactions/
│   │   ├── tags/
│   │   ├── budgets/
│   │   ├── goals/
│   │   ├── recurring/
│   │   ├── bills/
│   │   ├── subscriptions/
│   │   ├── loans/
│   │   ├── investments/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── calendar/
│   │   ├── search/
│   │   ├── importExport/
│   │   ├── notifications/
│   │   ├── insights/
│   │   ├── ai/
│   │   └── fx/
│   ├── jobs/                 # recurring, reminders
│   ├── utils/                # money, dates, pagination
│   └── lib/                  # prisma client, redis, mailer
└── tests/
```

Each module: `routes.js` → `controller.js` → `service.js` → `repository` (Prisma).

---

## 10. Implementation phases (backend)

### Phase 0 — Foundation
- Express app, env, logger, error handler, health check.
- DB schema + migrations for User, Account, Category, Transaction, Tag.
- Auth (register/login/JWT) + `auth` middleware.
- Seed script matching frontend mock user (`aarav@example.com`).

### Phase 1 — MVP API
- Accounts (+ transfer), Categories, Transactions (full CRUD), Tags.
- Budgets, Goals, Recurring (CRUD; job stub).
- Dashboard aggregate, basic Reports, CSV export/import.
- Settings (`/users/me`).
- Wire client: replace mock auth + core pages.

### Phase 2 — v2 API
- Bills, Subscriptions, Loans, Investments.
- Notifications + reminder jobs.
- Calendar, Search, Smart Insights, FX.
- AI stubs (rule-based) behind `/ai/*`.

### Phase 3 — Hardening & v3 hooks
- Audit logs, refresh tokens, rate limits.
- Receipt uploads, backup encryption.
- Webhooks/adapters for bank/Open Banking (interfaces only until providers exist).
- PDF/Excel polish, heatmap data API.

---

## 11. Cross-cutting concerns

| Concern | Approach |
|---------|----------|
| Multi-tenancy | Every query filters `user_id` from JWT |
| Money | Consistent decimal type; no float |
| Timezones | Store UTC timestamps; user `timezone` for display/jobs |
| Idempotency | Optional key on transfer/import |
| Pagination | `page` + `limit` on list endpoints |
| Validation | Zod schemas mirror frontend forms |
| Testing | Supertest for routes; unit tests for balance math |
| CORS | `CLIENT_ORIGIN=http://localhost:5173` |
| Env | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_ORIGIN` |

---

## 12. Frontend integration checklist

When backend endpoints land:

1. Add `client/.env` → `VITE_API_URL=http://localhost:5000/api/v1`.
2. Create `client/src/api/client.js` (fetch + token attach + 401 → logout).
3. Split `DataContext` into React Query / SWR hooks per module **or** keep context but call API inside methods.
4. Persist JWT in `httpOnly` cookie (preferred) or `localStorage` (MVP acceptable with XSS care).
5. Remove reliance on `mockData.js` except for Storybook/demo fixtures.
6. Keep DTO field names close to current UI (`title`, `amount`, `due`, etc.) or add a mapper layer.

---

## 13. Non-goals (for initial backend)

- Real bank / UPI / Open Banking connectors (v3).
- Production LLM costs without an abstraction.
- Native mobile apps.
- Shared family budgets / split expenses (v3).
- Heatmap charts (future).

---

## 14. Success criteria

Backend is “done enough” for the current UI when:

- [ ] User can register/login and hit all MVP pages with **persisted** data.
- [ ] Creating a transaction correctly updates account balance and budget progress.
- [ ] Transfer is atomic.
- [ ] Dashboard matches SQL aggregates (not client-only math).
- [ ] CSV export/import round-trips basic transactions.
- [ ] Notifications unread count matches server.
- [ ] All list endpoints are user-scoped (no IDOR).
- [ ] Client mock `DataContext` can be deleted without losing features.

---

## 15. Quick reference — entity ownership

| Entity | Owner module | Written by | Read by |
|--------|--------------|------------|---------|
| User | Auth/Users | Auth, Settings | All |
| Account | Accounts | Accounts, Transfer, Tx service | Dashboard, Reports, Bills… |
| Category | Categories | Categories | Tx, Budgets, Reports |
| Transaction | Transactions | Tx, Recurring job, Bill pay, Import | Almost everything |
| Tag | Tags | Tags | Tx, Search |
| Budget | Budgets | Budgets | Dashboard, Alerts, AI |
| Goal | Goals | Goals | Dashboard, Insights |
| RecurringRule | Recurring | Recurring + Job | Calendar, Dashboard |
| Bill | Bills | Bills | Calendar, Notifications |
| Subscription | Subscriptions | Subscriptions | Notifications, Insights |
| Loan | Loans | Loans | Net worth, Notifications |
| Investment | Investments | Investments | Net worth, Insights |
| Notification | Notifications | Many producers | Client badge/page |
| ExchangeRate | FX | Seed/job | Currencies, Reports |

---

*Document version: 1.0 · Aligned with client UI routes and feature-list MVP/v2/v3.*
