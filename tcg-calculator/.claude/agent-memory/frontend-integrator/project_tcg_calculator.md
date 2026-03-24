---
name: TCG Calculator Project Context
description: Architecture, API contract, and key conventions for the TCG Pricing Calculator Angular 21 app
type: project
---

This is an Angular 21 standalone-component SPA for TCG (trading card game) marketplace pricing.

Backend API runs at `http://localhost:3000/api` (configured via `src/environments/environment.ts`).

**Why:** The owner runs a TCG shop selling on Shopee, Lazada, TikTok Shop and other Malaysian marketplaces. The calculator computes selling price from cost + platform fee + desired margin.

**How to apply:** When touching pricing logic, preserve the formula exactly: `Sell Price = TotalCost / (1 - platformFee% - desiredMargin%)`. Do not change rounding helpers `round1`/`round2`. All components are standalone — no NgModules.

Key architectural decisions:
- Access token stored in-memory (AuthService signal), NOT localStorage. Refresh token is httpOnly cookie.
- APP_INITIALIZER runs auth.init() + platformService.load() + presetService.load() on startup.
- SkuItem has both `id` (local frontend) and optional `backendId` (DB id) to decouple UI state from API IDs.
- Auto-save uses RxJS Subject + debounceTime(2000) in CalculatorComponent.
- Sessions page navigates to /calculator with `history.state.skus` to pass loaded SKUs.
