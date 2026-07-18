# FinanceOS Server

Node.js + Express + **PostgreSQL** + Prisma backend.

## Docs

- **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)** — full architecture

## Quick start

```bash
cd server
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: `http://localhost:5000/api/v1`  
Health: `http://localhost:5000/api/v1/health`

### Demo user

- Email: `aarav@example.com`
- Password: `demo1234`

## Postman

Import collection from [`postman/`](./postman/):

- `FinanceOS_API.postman_collection.json`
- `FinanceOS_Local.postman_environment.json`

See [`postman/README.md`](./postman/README.md) for auth setup.

## Architecture

```
routes.js → controller.js → service.js → repository.js (Prisma via db())
```

| Layer | Responsibility |
|-------|----------------|
| **routes** | HTTP paths, middleware (`authRequired`), bind controllers |
| **controller** | Zod validation, status codes, `ok()` responses |
| **service** | Business rules, orchestration, mapping, `AppError` |
| **repository** | Prisma / DB access only |

## Implemented

### Phase 0–1 (MVP)
Health, Auth, Users, Accounts, Categories, Transactions, Tags, Budgets, Goals, Recurring, Dashboard

### Phase 2
| Area | Routes |
|------|--------|
| Bills | CRUD + `POST /bills/:id/pay` |
| Subscriptions | CRUD + pause/resume |
| Loans | CRUD + `GET /loans/:id/schedule` |
| Investments | CRUD |
| Notifications | list, read, read-all |
| Calendar | `GET /calendar?year=&month=` |
| Search | `GET /search?q=` |
| Reports | `/reports/overview`, `/cashflow`, `/categories` |
| FX | `/fx/rates`, `/fx/convert` |
| AI | `/ai/suggestions`, `/ai/chat` (rule-based) |

## Next

- Import/export + backup
- Recurring auto-create / reminder jobs
- Wire React client to this API (replace `DataContext` mocks)
