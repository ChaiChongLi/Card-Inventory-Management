# TCG Pricing System

A full-stack web application for TCG (Trading Card Game) resellers to manage pricing, inventory batches, sales tracking, and profit distribution across multiple e-commerce platforms.

## Features

### Pricing Calculator
- Calculate optimal selling prices based on product cost, shipping, platform fees, and desired profit margin
- Real-time break-even analysis and margin validation
- Support for multiple platforms (Shopee, etc.) with configurable fee rates
- Bulk SKU management with duplicate, export to CSV
- Session-based saving of calculator states

### Batch & Inventory Management
- Create and manage inventory batches (OPEN / CLOSED)
- Track individual items: quantity purchased, unit cost, notes
- Record sales per item with platform attribution and sale price
- Auto-calculate total cost, revenue, gross profit, and unsold stock per batch

### Partner Profit Distribution
- Define partner shares as percentages
- Configure retained amount (fixed or percentage) before distribution
- Generate a distribution breakdown per batch showing each partner's payout

### Dashboard
- Summary cards: open/closed batches, total revenue, shop purchases
- Revenue trend chart (last 30 days or all time)
- Revenue by platform donut chart
- Recent batches table

### Admin Panel
- User management (ADMIN / WORKER roles)
- Platform management with configurable fee percentages
- Partner management
- Shop purchases tracking

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components) |
| Language | TypeScript |
| State | Angular Signals |
| Styling | SCSS with CSS custom properties |
| Charts | ApexCharts (`ng-apexcharts`) |
| Testing | Vitest |
| Auth | JWT (access token + refresh interceptor) |

## Project Structure

```
tcg-calculator/
└── src/
    └── app/
        ├── core/
        │   ├── guards/          # Auth & admin route guards
        │   ├── interceptors/    # JWT attach & token refresh
        │   └── services/        # Auth, platform, batch, dashboard, etc.
        ├── features/
        │   ├── calculator/      # Pricing calculator page
        │   ├── dashboard/       # Analytics dashboard
        │   ├── login/           # Login page
        │   ├── sessions/        # Saved calculator sessions
        │   └── admin/           # Admin panel (users, platforms, batches, partners)
        └── shared/
            └── models/          # Shared TypeScript interfaces & API types
```

## Getting Started

### Prerequisites

- Node.js 18+
- Angular CLI 21+

```bash
npm install -g @angular/cli
```

### Installation

```bash
cd tcg-calculator
npm install
```

### Development

```bash
ng serve
```

Open `http://localhost:4200` in your browser.

### Build

```bash
ng build
```

Production artifacts are output to `dist/tcg-calculator/browser/`.

### Tests

```bash
# Unit tests (Vitest)
ng test

# End-to-end tests
ng e2e
```

## Roles

| Role | Access |
|---|---|
| `WORKER` | Calculator, Dashboard, Sessions |
| `ADMIN` | All of the above + Admin panel (users, platforms, partners, batches) |

## Pricing Formula

Selling price is derived from:

```
Selling Price = Total Cost / (1 - Platform Fee% - Desired Margin%)
```

Where:
- **Total Cost** = Product Cost + Shipping Cost
- **Platform Fee Amount** = Selling Price × Platform Fee%
- **Profit per Unit** = Selling Price − Platform Fee Amount − Total Cost
- **Break-even** = Total Cost / (1 − Platform Fee%)

A warning is shown when combined platform fee + desired margin exceeds 60%.

## Environment Configuration

Set your API base URL in `src/environments/`:

```ts
// environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

```ts
// environment.prod.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://your-api-domain.com',
};
```
