# TCG Calculator — AI System Context

> Complete technical reference for any AI assistant working on this codebase.
> Read this file to understand the full system before making changes.

---

## 1. Project Overview

A full-stack web application for TCG (Trading Card Game) resellers to:
- Calculate selling prices with platform fee + profit margin formulas
- Track inventory batches (cost of goods purchased, including batch-level overhead fees)
- Record actual sale prices per item (multiple sale records per item at different prices/platforms)
- Distribute profits among business partners with per-partner income slips

**Two separate repositories:**
| Folder | Stack | Port |
|--------|-------|------|
| `tcg-calculator-api/` | Node.js + Express + TypeScript + Prisma + MySQL | 3000 |
| `tcg-calculator/` | Angular 21 + TypeScript | 4200 |

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend framework | Express.js | 4.x |
| ORM | Prisma | 5.x |
| Database | MySQL | 8.x |
| Backend language | TypeScript | 5.x |
| Backend runner | `tsx` (dev), `node dist/` (prod) | |
| Input validation | Zod | 3.x |
| Auth tokens | `jsonwebtoken` + `bcryptjs` | — |
| Security | `helmet`, `cors`, `express-rate-limit` | — |
| Frontend framework | Angular (standalone components) | 21.x |
| State management | Angular Signals | — |
| HTTP client | Angular `HttpClient` | — |
| Charts | `ng-apexcharts` / ApexCharts | — |

---

## 3. Repository Structure

### Backend `tcg-calculator-api/`

```
prisma/
  schema.prisma          ← full DB schema (source of truth)
  migrations/            ← SQL migrations (auto-generated)
  seed.ts                ← seed admin user + default platforms/presets

src/
  app.ts                 ← Express app setup, routes mounted, error handler
  config/
    database.ts          ← Prisma client singleton
    env.ts               ← Zod-validated env vars (DATABASE_URL, JWT secrets, etc.)
  middleware/
    auth.middleware.ts   ← JWT verification → populates req.user
    admin.middleware.ts  ← requireAdmin: checks req.user.role === 'ADMIN'
    error.middleware.ts  ← AppError class + global error handler
  modules/
    auth/                ← login, refresh, logout, /me
    users/               ← CRUD for WORKER accounts (admin only)
    platforms/           ← selling platform CRUD + reorder
    sessions/            ← calculator session CRUD (backend only, frontend UI removed)
    skus/                ← bulk-replace + single-update SKU auto-save
    presets/             ← product name presets (admin only)
    batches/             ← batch lifecycle, stock items, sale records, distribution
    partners/            ← profit-sharing partner CRUD + available-users endpoint (admin only)
    dashboard/           ← user-facing stats endpoint
    admin/               ← admin-facing stats endpoint
```

**Critical startup detail:** `src/app.ts` must have `import 'dotenv/config'` as its **first line** or env vars won't be loaded before Zod validation runs.

### Frontend `tcg-calculator/src/app/`

```
app.routes.ts            ← route definitions with auth/admin guards
app.ts                   ← root component
core/
  guards/
    auth.guard.ts        ← redirects to /login if not authenticated
    admin.guard.ts       ← redirects if role !== ADMIN
  interceptors/
    auth.interceptor.ts  ← adds Authorization: Bearer <token> header
    refresh.interceptor.ts ← catches 401 → POST /refresh → retry original request
  services/
    auth.service.ts      ← accessToken signal, currentUser signal, login/logout
    platform.service.ts  ← platform list + slug→numericId lookup (unwraps {data:[]})
    preset.service.ts    ← product presets list
    user.service.ts      ← admin user CRUD
    partner.service.ts   ← admin partner CRUD
    batch.service.ts     ← batch + item + sale record + distribution CRUD
    dashboard.service.ts ← stats endpoint
features/
  login/                 ← login form
  dashboard/             ← stat cards + ApexCharts (area + donut)
  calculator/            ← SKU table, formula (accessed via "Open in Calculator" from batch)
  admin/
    admin-shell.component.ts    ← layout wrapper with side nav
    users/                      ← user CRUD
    platforms/                  ← platform CRUD (all API calls unwrap {data:...})
    partners/                   ← partner CRUD (user dropdown, any role allowed)
    batches/
      batches.component.ts      ← batch list
      batch-detail.component.ts ← stock items + expandable sale records + distribution
shared/
  models/api.models.ts   ← TypeScript interfaces matching all API responses
```

**Removed from frontend:** Sessions feature (`sessions/` component, `/sessions` route, Sessions nav link, Calculator nav link). The calculator is only accessed via "Open in Calculator" inside batch detail.

---

## 4. Database Schema

### Enums
```
Role            ADMIN | WORKER
BatchStatus     OPEN | CLOSED
RetainedMode    FIXED_AMOUNT | PERCENTAGE
```

### Models

**User** — system accounts
```
id            Int      PK autoincrement
username      String   unique max(100)
passwordHash  String   max(255)
role          Role     default(WORKER)
isActive      Bool     default(true)
isDeleted     Bool     soft-delete flag
createdAt/updatedAt
→ sessions[]      (Session)
→ refreshTokens[] (RefreshToken)
→ partner         (Partner, optional 1:1)
```

**RefreshToken** — long-lived refresh tokens stored in DB
```
id        Int      PK
token     String   unique max(512)   ← 64-byte hex random
userId    Int      FK → User
expiresAt DateTime
isRevoked Bool     default(false)
createdAt
```

**Platform** — selling channels (Shopee, eBay, etc.)
```
id             Int      PK
slug           String   unique max(50)   ← used as frontend ID
name           String   max(100)
feePercent     Decimal  (5,2)            ← e.g. 12.50 = 12.5%
isCustomizable Bool     ← if true, SKU can override fee
isActive       Bool
isDeleted      Bool
sortOrder      Int      default(0)
createdAt/updatedAt
→ skuItems[]    (SkuItem)
→ saleRecords[] (SaleRecord)   ← platform a sale was made on
```

**Session** — a named calculator workspace per user (backend only, frontend UI removed)
```
id          Int      PK
name        String   max(200)
description String?
userId      Int      FK → User
isDeleted   Bool
createdAt/updatedAt
→ skuItems[] (SkuItem)
```

**SkuItem** — one product row in the calculator
```
id               Int      PK
sessionId        Int      FK → Session
platformId       Int      FK → Platform
name             String   max(200)
productCost      Decimal  (10,2)
shippingCost     Decimal  (10,2)
customFeePercent Decimal? (5,2)    ← null = use platform's feePercent
desiredMargin    Decimal  (5,2)    ← target profit margin %
quantity         Int      default(1)
sortOrder        Int      default(0)
isDeleted        Bool
createdAt/updatedAt
```

**ProductPreset** — suggested product names for autocomplete
```
id        Int     PK
name      String  max(200)
sortOrder Int
isDeleted Bool
createdAt/updatedAt
```

**Partner** — a profit-sharing stakeholder (linked to any User account, any role)
```
id          Int     PK
userId      Int     unique FK → User   ← 1:1, any role allowed (ADMIN or WORKER)
displayName String  max(100)
isActive    Bool
isDeleted   Bool
createdAt/updatedAt
→ distributionShares[] (DistributionShare)
```

**Batch** — a round of inventory purchases to track collectively
```
id          Int         PK
name        String      max(200)
description String?
status      BatchStatus default(OPEN)
deliveryFee Decimal     (10,2) default(0)   ← batch-level delivery/shipping overhead
otherFees   Decimal     (10,2) default(0)   ← batch-level other overhead
isDeleted   Bool
createdAt/updatedAt
→ batchItems[]  (BatchItem)
→ distribution  (Distribution, optional 1:1)
```

**BatchItem** — a stock line item purchased for a batch (NO sale price here)
```
id        Int      PK
batchId   Int      FK → Batch
itemName  String   max(200)
quantity  Int      default(1)          ← total units purchased
unitCost  Decimal  (10,2)              ← cost per unit
notes     String?  max(500)
isDeleted Bool
createdAt/updatedAt
→ saleRecords[] (SaleRecord)           ← individual sale transactions
```

**SaleRecord** — one sale transaction for a batch item (many per item, different prices)
```
id            Int      PK
batchItemId   Int      FK → BatchItem
quantity      Int      default(1)       ← units sold in this transaction
unitSalePrice Decimal  (10,2)           ← price per unit for this sale
platformId    Int?     FK → Platform    ← platform sold on (optional)
notes         String?  max(500)
isDeleted     Bool
createdAt/updatedAt
Indexes: batchItemId, batchItemId+isDeleted, isDeleted
```

**Distribution** — profit calculation snapshot for a batch (1:1 with Batch)
```
id                Int          PK
batchId           Int          unique FK → Batch
totalRevenue      Decimal      (12,2)   ← sum of all sale records
totalCost         Decimal      (12,2)   ← item costs + batch deliveryFee + otherFees
grossProfit       Decimal      (12,2)   ← totalRevenue - totalCost
retainedMode      RetainedMode
retainedValue     Decimal      (12,2)   ← the input value (amount or %)
retainedAmount    Decimal      (12,2)   ← calculated retained
distributedAmount Decimal      (12,2)   ← grossProfit - retainedAmount
notes             String?
isDeleted         Bool
createdAt/updatedAt
→ shares[] (DistributionShare)
```

**DistributionShare** — per-partner slice of a distribution
```
id             Int     PK
distributionId Int     FK → Distribution
partnerId      Int     FK → Partner
percentage     Decimal (5,2)    ← partner's % of distributedAmount
amount         Decimal (12,2)   ← calculated: distributedAmount × (percentage/100)
isDeleted      Bool
createdAt/updatedAt
UNIQUE (distributionId, partnerId)
```

---

## 5. API Reference

All routes prefixed with `/api`. Authenticated routes require `Authorization: Bearer <accessToken>`.

### Auth `/api/auth`
| Method | Path | Auth | Body | Returns |
|--------|------|------|------|---------|
| POST | `/login` | ❌ | `{username, password}` | `{accessToken, user}` + sets httpOnly refreshToken cookie |
| POST | `/refresh` | ❌ | — (reads cookie) | `{accessToken}` |
| POST | `/logout` | ❌ | — (reads cookie) | 200 OK, clears cookie |
| GET | `/me` | ✅ | — | `{id, username, role, isActive, createdAt}` |

### Users `/api/users` (ADMIN only)
| Method | Path | Body |
|--------|------|------|
| GET | `/` | — (query: `?search=&page=&limit=`) |
| POST | `/` | `{username, password}` — creates WORKER |
| GET | `/:id` | — |
| PATCH | `/:id` | `{username?, password?, isActive?}` |
| DELETE | `/:id` | — (soft delete, cannot delete ADMIN) |

### Platforms `/api/platforms`
| Method | Path | Auth | Body |
|--------|------|------|------|
| GET | `/` | ✅ any | — returns `{ data: ApiPlatform[] }` |
| POST | `/` | ✅ ADMIN | `{slug, name, feePercent, isCustomizable?, isActive?, sortOrder?}` |
| PATCH | `/:id` | ✅ ADMIN | partial — returns `{ data: ApiPlatform }` |
| DELETE | `/:id` | ✅ ADMIN | — |
| PATCH | `/reorder` | ✅ ADMIN | `{items: [{id, sortOrder}]}` |

**All platform responses wrap data as `{ data: ... }`** — always unwrap in frontend.

### Sessions `/api/sessions` (backend only — frontend UI removed)
| Method | Path | Body |
|--------|------|------|
| GET | `/` | — (query: `?search=`) |
| POST | `/` | `{name, description?}` |
| GET | `/:id` | — (returns session + all SKUs with platform) |
| PATCH | `/:id` | `{name?, description?}` |
| DELETE | `/:id` | — |

### SKUs `/api/sessions/:sessionId/skus`
| Method | Path | Body | Notes |
|--------|------|------|-------|
| PUT | `/` | `{items: [{id?, platformId, name, productCost, shippingCost, customFeePercent?, desiredMargin, quantity, sortOrder}]}` | Bulk-replace: upsert all, soft-delete omitted |
| PATCH | `/:id` | partial SkuItem fields | Update one field |

### Presets `/api/presets`
| Method | Path | Auth |
|--------|------|------|
| GET | `/` | ✅ any |
| POST | `/` | ✅ ADMIN — `{name, sortOrder?}` |
| PATCH | `/:id` | ✅ ADMIN — partial |
| DELETE | `/:id` | ✅ ADMIN |

### Batches `/api/batches` (ADMIN only)
| Method | Path | Body |
|--------|------|------|
| GET | `/` | — |
| POST | `/` | `{name, description?}` |
| GET | `/:id` | — returns `BatchSummary` with `deliveryFee`, `otherFees`, `totalCost` (fees included) |
| PATCH | `/:id` | `{name?, description?, deliveryFee?, otherFees?}` (OPEN only) |
| DELETE | `/:id` | — (OPEN only) |
| POST | `/:id/close` | — (requires distribution to exist) |
| GET | `/:id/items` | — |
| POST | `/:id/items` | `{itemName, quantity, unitCost, notes?}` |
| PATCH | `/:id/items/:itemId` | `{itemName?, quantity?, unitCost?, notes?}` |
| DELETE | `/:id/items/:itemId` | — (soft delete) |
| GET | `/:id/items/:itemId/sales` | — |
| POST | `/:id/items/:itemId/sales` | `{quantity, unitSalePrice, platformId?, notes?}` |
| PATCH | `/:id/items/:itemId/sales/:saleId` | `{quantity?, unitSalePrice?, platformId?, notes?}` |
| DELETE | `/:id/items/:itemId/sales/:saleId` | — (soft delete) |
| GET | `/:id/distribution` | — (null if not set) |
| POST | `/:id/distribution` | `{retainedMode: 'FIXED_AMOUNT'|'PERCENTAGE', retainedValue, notes?, shares:[{partnerId, percentage}]}` |

### Partners `/api/partners` (ADMIN only)
| Method | Path | Body |
|--------|------|------|
| GET | `/available-users` | — returns all users (any role) with no partner linked yet |
| GET | `/` | — |
| POST | `/` | `{userId, displayName}` — userId can be any role |
| PATCH | `/:id` | `{displayName?, isActive?}` |
| DELETE | `/:id` | — |

**Note:** `GET /available-users` must be declared before `/:id` routes in the router to avoid being shadowed.

### Dashboard `/api/dashboard`
| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/` | ✅ any | `{totalWorkers, totalSessions, activeSessions, totalSkus, sessionsPerDay[], skusByPlatform[], recentSessions[]}` |

### Admin `/api/admin`
| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/dashboard` | ✅ ADMIN | admin-level aggregate stats |

### Health
| GET | `/health` | ❌ | `{status: "ok"}` |

---

## 6. Business Logic

### 6a. Calculator Formula

Given a SkuItem, the selling price is derived so that after deducting the platform fee, the remaining profit equals the desired margin percentage of the selling price.

```
totalCost       = (productCost + shippingCost)
effectiveFee%   = customFeePercent ?? platform.feePercent
divisor         = 1 - (effectiveFee% / 100) - (desiredMargin / 100)

if divisor <= 0: invalid (fee + margin >= 100%)
if totalCost <= 0: invalid (no cost entered)

sellingPrice      = totalCost / divisor
platformFeeAmount = sellingPrice × (effectiveFee% / 100)
profitPerUnit     = sellingPrice - platformFeeAmount - totalCost
actualMargin      = (profitPerUnit / sellingPrice) × 100
breakEven         = totalCost / (1 - effectiveFee% / 100)
totalProfit       = profitPerUnit × quantity
```

Frontend rounds sellingPrice/costs to 2dp, margins to 1dp.

The calculator is accessed only via "Open in Calculator" button in batch detail. Navigation passes `history.state = { skus: SkuItem[], batchId: number, batchName: string }`. The calculator shows a "← Back to Batch" button when `fromBatchId` signal is set.

### 6b. Batch Lifecycle

```
OPEN ──→ (batch overhead fees saved: deliveryFee, otherFees)
     ──→ (stock items added/updated/deleted)
     ──→ (sale records added per item: each record has qty + price + platform)
     ──→ (distribution saved: shares must sum to 100%)
     ──→ POST /close → CLOSED

CLOSED: immutable — no mutations allowed on batch, items, sale records, or distribution
```

### 6c. Sale Records (Multi-Price Per Item)

Each `BatchItem` can have multiple `SaleRecord` entries. This supports selling different units at different prices or on different platforms. The UI shows all sale records in an expandable sub-table per item with individual Edit and Delete buttons.

```
Example: bought 200 units at RM5 each
  SaleRecord 1: qty=80, price=RM10, platform=Shopee
  SaleRecord 2: qty=50, price=RM15, platform=eBay
  SaleRecord 3: qty=30, price=RM20, platform=Direct
  Unsold: 200 - 80 - 50 - 30 = 40 units

soldQuantity   = 160
unsoldQuantity = 40
totalRevenue   = 80×10 + 50×15 + 30×20 = 2,150
totalCost      = 200×5 = 1,000
profit         = 1,150
```

Validation: creating or updating a sale record checks that `otherSales.qty + newQty ≤ item.quantity`.

### 6d. Distribution Calculation

```
totalCost     = Σ (item.quantity × item.unitCost) + batch.deliveryFee + batch.otherFees
totalRevenue  = Σ Σ (saleRecord.quantity × saleRecord.unitSalePrice)
grossProfit   = totalRevenue - totalCost

if retainedMode = FIXED_AMOUNT:
  retainedAmount = retainedValue
if retainedMode = PERCENTAGE:
  retainedAmount = grossProfit × (retainedValue / 100)

distributedAmount = grossProfit - retainedAmount

for each share:
  share.amount = distributedAmount × (share.percentage / 100)

Constraint: Σ share.percentage must = 100 (±0.01 tolerance)
```

The batch-level `deliveryFee` and `otherFees` are included in `totalCost` in both the live `BatchSummary` and the saved `Distribution` snapshot.

### 6e. Platform Revenue Breakdown

Computed on the frontend from `items[].saleRecords[]`. Groups all sale records by `platformName`, sums `quantity × unitSalePrice` per group. Displayed in the distribution saved view and the print document. Used to show which platform generated what share of revenue.

### 6f. Per-Partner Income Slip

A printable income statement generated per partner from the saved distribution. Opens in a new browser window via `window.open()` with auto-print on load. Contains: batch name, date, total revenue/cost/profit, platform revenue breakdown, retained amount, the partner's %, and their calculated payout.

---

## 7. Auth Architecture

```
Access Token  — JWT, short-lived (15m), payload: {userId, username, role}
              — Stored: AuthService.accessToken signal (in-memory only)
              — Sent: Authorization: Bearer header via auth.interceptor.ts

Refresh Token — 64-byte cryptographically random hex string
              — Stored: DB (RefreshToken table) + httpOnly Secure SameSite=Strict cookie
              — Used: POST /api/auth/refresh
              — Rotated: each login creates new; old stay until expiry or revocation

Auto-refresh flow:
  1. Request made → 401 Unauthorized
  2. refresh.interceptor.ts catches 401
  3. POST /api/auth/refresh (browser auto-sends cookie)
  4. New access token returned → stored in signal
  5. Original request retried with new token
  6. If refresh fails → logout + redirect /login

Startup flow:
  1. APP_INITIALIZER calls AuthService.init()
  2. POST /api/auth/refresh (silent check)
  3. If cookie valid → user restored without login prompt
  4. If no cookie → redirected to /login on first protected route
```

---

## 8. Frontend State Management

Key signals in `AuthService`:
```typescript
accessToken = signal<string | null>(null)
currentUser = signal<{ id, username, role } | null>(null)
isLoggedIn  = computed(() => this.accessToken() !== null)
isAdmin     = computed(() => this.currentUser()?.role === 'ADMIN')
```

Platform lookup pattern (slug ↔ numeric ID):
- Frontend uses slugs (`'shopee'`, `'ebay'`) as platform identifiers in `SkuItem`
- Backend stores numeric `platformId` in DB
- `PlatformService.getNumericId(slug)` performs the mapping when saving
- `platform.service.ts` unwraps `{ data: ApiPlatform[] }` from API response

Calculator state passed via `history.state`:
```typescript
{ skus: SkuItem[], batchId: number, batchName: string }
```

Key signals in `BatchDetailComponent`:
```typescript
batch              = signal<BatchSummary | null>(null)
items              = signal<BatchItem[]>([])
distribution       = signal<DistributionDetail | null>(null)
expandedItemIds    = signal<number[]>([])        ← which items show sale records
deliveryFeeInput   = signal<number>(0)
otherFeesInput     = signal<number>(0)
platformBreakdown  = computed(...)               ← grouped revenue by platform name
```

---

## 9. Frontend Routes

```
/                     → redirect /dashboard
/login                → LoginComponent      (noAuthGuard: redirect away if logged in)
/dashboard            → DashboardComponent  (authGuard)
/calculator           → CalculatorComponent (authGuard) — accessed via batch, not nav
/admin                → AdminShellComponent (adminGuard: ADMIN role only)
  /admin/users        → UsersComponent
  /admin/platforms    → PlatformsComponent
  /admin/partners     → PartnersComponent
  /admin/batches      → BatchesComponent
  /admin/batches/:id  → BatchDetailComponent
**                    → redirect /dashboard
```

**Nav bar** (dashboard): Dashboard | Admin (if admin). No Sessions, no Calculator links.

---

## 10. Error Handling

Backend uses `AppError(statusCode, code, message)`:
```
404  BATCH_NOT_FOUND      / ITEM_NOT_FOUND / SALE_NOT_FOUND / SESSION_NOT_FOUND / USER_NOT_FOUND / PARTNER_NOT_FOUND
400  BATCH_CLOSED         Cannot modify a closed batch
400  BATCH_ALREADY_CLOSED Batch is already closed
400  DISTRIBUTION_REQUIRED Save distribution before closing
400  INVALID_SHARES       Percentages must sum to 100
400  QUANTITY_EXCEEDED    Sale qty would exceed purchased qty
400  INVALID_ID           Non-numeric ID param
400  VALIDATION_ERROR     Zod parse failure (ZodError caught globally)
409  PARTNER_ALREADY_EXISTS User already linked to a partner
401  UNAUTHORIZED         Invalid/missing JWT
403  FORBIDDEN            Role check failed
```

Global error middleware formats all errors as:
```json
{ "error": "Human message", "code": "MACHINE_CODE" }
```

---

## 11. Conventions & Patterns

- **Soft deletes everywhere**: always `isDeleted: false` in WHERE, set `isDeleted: true` on delete
- **Decimal fields**: Prisma returns `Decimal` objects — always convert with `Number(value.toString())` before returning in API responses
- **Response envelope**: all API responses wrap data as `{ data: ... }` (success) or `{ error: ..., code: ... }` (failure)
- **Admin-only mutation guards**: batches, partners, users, platforms, presets all require `requireAdmin` middleware
- **OPEN-only mutation guards**: batch items, sale records, and distribution can only be modified when `batch.status === 'OPEN'`
- **Zod schemas inline**: validation schemas defined at top of each router file
- **No controller layer**: routers call service functions directly
- **Environment config**: `src/config/env.ts` exports a validated `config` object; do not use `process.env` directly elsewhere
- **`RetainedMode` enum**: always `FIXED_AMOUNT` (not `FIXED`) — both frontend type and backend Zod schema use this exact string
- **Partners accept any role**: both ADMIN and WORKER users can be linked as partners — no role restriction on creation

---

## 12. Development Commands

### Backend (`tcg-calculator-api/`)
```bash
npm run dev              # tsx watch mode
npm run build            # tsc → dist/
npm run start            # node dist/app.js
npm run db:migrate       # npx prisma migrate dev
npm run db:generate      # npx prisma generate
npm run db:seed          # ts-node prisma/seed.ts (creates admin + default data)
npm run db:studio        # Prisma Studio GUI
```

### Frontend (`tcg-calculator/`)
```bash
npm start                # ng serve
npm run build            # ng build (production by default)
npm run watch            # ng build --watch
```

### After schema changes (always run both):
```bash
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

**Important:** After a Prisma migration, the backend `dev` server must be restarted if `prisma generate` failed during the migration (e.g. due to a locked DLL on Windows while the server was running).

---

## 14. Docker Deployment

### Architecture

All three services run in a single Docker Compose stack:

```
Browser → nginx (port 80)
            ├── /          → Angular static files (/usr/share/nginx/html)
            └── /api/*     → backend:3000 (internal, not exposed)
                               └── db:3306 (internal, not exposed)
```

### Files

```
docker-compose.yml          ← localhost deployment
docker-compose.prod.yml     ← VPS deployment
.env.example                ← environment variable template (localhost)
.env.prod.example           ← environment variable template (VPS, adds CORS_ORIGIN)
tcg-calculator-api/
  Dockerfile                ← multi-stage: build TS → production Node runner
  entrypoint.sh             ← runs prisma migrate deploy then node dist/app.js
tcg-calculator/
  Dockerfile                ← multi-stage: build Angular → nginx:alpine
  nginx.conf                ← serves static + proxies /api to backend container
  src/environments/
    environment.ts          ← dev: apiUrl = http://localhost:3000/api
    environment.prod.ts     ← prod: apiUrl = /api (nginx proxies, no hardcoded host)
```

Angular production builds automatically use `environment.prod.ts` via `fileReplacements` in `angular.json`.

### Localhost setup

```bash
# 1. Copy env template and fill in secrets
cp .env.example .env

# 2. Generate JWT secrets
openssl rand -hex 32   # run twice — one for ACCESS, one for REFRESH

# 3. Build and start
docker compose up -d --build

# 4. Seed the database (first time only)
docker exec tcg-backend npx prisma db seed

# App is now at http://localhost
```

### VPS setup

```bash
# 1. Copy env template and fill in secrets + domain
cp .env.prod.example .env.prod

# 2. Build and start using the prod compose file
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 3. Seed the database (first time only)
docker exec tcg-backend npx prisma db seed

# App is now at http://yourdomain.com
```

> For HTTPS on VPS, terminate SSL in front of the stack (e.g. Caddy, Nginx reverse proxy + Certbot, or Cloudflare). The container itself only listens on port 80.

### Useful commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service after code change
docker compose up -d --build backend

# Stop everything
docker compose down

# Stop and remove volumes (⚠ deletes database)
docker compose down -v

# Run a migration manually
docker exec tcg-backend npx prisma migrate deploy

# Open Prisma Studio (dev only — not available in production image)
# Run locally: npm run db:studio in tcg-calculator-api/
```

---

## 13. Known Gotchas

1. **`import 'dotenv/config'` must be the first line of `src/app.ts`** — env vars must load before Zod parses `config/env.ts`
2. **Prisma Decimal ≠ JS number** — wrap all Decimal fields with `Number(value.toString())` before JSON serialization
3. **Platform slug vs numeric ID** — frontend uses slugs, DB stores numeric IDs; `PlatformService.getNumericId()` bridges this
4. **All API responses use `{ data: ... }` envelope** — never call `get<ApiPlatform[]>`, always `get<{ data: ApiPlatform[] }>` and unwrap `.data`
5. **Refresh token cookie** — must configure `credentials: 'include'` in Angular `HttpClient` (handled by `withCredentials: true` in interceptors) and CORS `credentials: true` + explicit origin
6. **Distribution upsert** — `Distribution.batchId` has `@unique`. Shares are fully deleted and recreated on each save
7. **Batch close requires distribution** — `POST /:id/close` returns 400 `DISTRIBUTION_REQUIRED` if no distribution exists
8. **SaleRecord quantity validation** — creating/updating a sale record validates that total sold qty across all records doesn't exceed `BatchItem.quantity`
9. **`/available-users` route ordering** — in `partners.router.ts`, `GET /available-users` is declared before `GET /:id` to prevent Express matching `available-users` as an ID param
10. **Calculator accessed only via batch** — the `/calculator` route exists but is not in the nav; access it through "Open in Calculator" in batch detail which passes `history.state`
11. **Batch `totalCost` includes overhead fees** — `BatchSummary.totalCost = Σ item costs + deliveryFee + otherFees`; same formula used in `upsertDistribution`
12. **Prisma generate after migration on Windows** — if the server is running during `prisma migrate dev`, the generate step may fail with EPERM (DLL locked); restart the server after migration to reload the new client
13. **`APP_INITIALIZER` must not call auth-protected endpoints before auth check** — `app.config.ts` calls `authService.init()` first, then only loads `platformService` and `presetService` if `isLoggedIn()` is true. If called unconditionally, parallel 401 responses cause a deadlock in `refresh.interceptor.ts` where one request starts the refresh flow and the other waits in `waitForNewToken()` forever (since refresh fails and emits `null`, which `filter(token !== null)` blocks). Fixed by: (a) guarding loads behind `isLoggedIn()` in `app.config.ts`, (b) loading platforms/presets in `login.component.ts` after successful login, (c) emitting `REFRESH_FAILED` sentinel in `refresh.interceptor.ts` to unblock waiting requests on refresh failure.
14. **`PresetService.load()` must use `{ data: ApiPreset[] }` response type** — `/api/presets` returns `{ data: [...] }` envelope just like all other endpoints. Using `get<ApiPreset[]>` gives you the wrapper object, not the array, causing `.sort()` to throw a "not iterable" error (caught silently, falling back to defaults).
