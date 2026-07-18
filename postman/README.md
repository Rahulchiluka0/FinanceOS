# FinanceOS Postman

## Files

| File | Purpose |
|------|---------|
| `FinanceOS_API.postman_collection.json` | All API requests (~78 endpoints) |
| `FinanceOS_Local.postman_environment.json` | Local `baseUrl` environment |

## Import

1. Open Postman → **Import**
2. Select both JSON files above
3. Choose environment **FinanceOS Local** (top-right)
4. Ensure API is running: `cd server && npm run dev`

## Auth flow

1. Open folder **Auth → Login**
2. Send (demo: `aarav@example.com` / `demo1234`)
3. Test script saves JWT into collection variable `token`
4. Other folders use `Bearer {{token}}` automatically

## Tips

- Run **Accounts → List accounts** to fill `accountId` / `accountId2`
- Run other **List *** requests to fill `categoryId`, `billId`, etc.
- `baseUrl` default: `http://localhost:5000/api/v1`
