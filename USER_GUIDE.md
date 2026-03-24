# TCG Calculator — User Guide

A web app for TCG resellers to calculate selling prices, track inventory, and split profits between partners.

---

## Getting Started

There are two ways to run the app: **Docker** (recommended for deployment) or **local development**.

---

### Option A — Docker (recommended)

**Requirements:** Docker Desktop installed and running.

#### Localhost

```bash
# 1. Copy the env template
cp .env.example .env

# 2. Open .env and fill in your secrets:
#    - MYSQL_ROOT_PASSWORD, MYSQL_USER, MYSQL_PASSWORD
#    - JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
#      (generate each with: openssl rand -hex 32)

# 3. Build and start all services
docker compose up -d --build

# 4. First time only — seed the database (creates admin account + default platforms)
docker exec tcg-backend npx prisma db seed
```

Open your browser at **http://localhost**

#### VPS / Production server

```bash
# 1. Copy the prod env template
cp .env.prod.example .env.prod

# 2. Fill in secrets AND set CORS_ORIGIN=https://yourdomain.com

# 3. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. First time only — seed the database
docker exec tcg-backend npx prisma db seed
```

Open your browser at **http://yourdomain.com**

> **HTTPS on VPS:** The Docker stack runs on port 80. To enable HTTPS, put a reverse proxy in front (e.g. Caddy, Nginx + Certbot, or Cloudflare).

**Useful Docker commands:**
```bash
docker compose logs -f backend     # view backend logs
docker compose logs -f frontend    # view frontend logs
docker compose down                # stop everything
docker compose up -d --build       # restart after code changes
```

---

### Option B — Local development

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd tcg-calculator-api
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd tcg-calculator
npm start
```

Open your browser at **http://localhost:4200**

### 2. Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |

> Change the admin password after first login.

---

## Roles

| Role | What they can do |
|------|-----------------|
| **Admin** | Everything — manage users, platforms, batches, partners, view admin panel |
| **Worker** | Use the calculator only (accessed from a batch) |

---

## Navigation

- Click the **TCG Pricing** logo at the top left to go back to the Dashboard at any time.
- The nav bar shows **Dashboard** and **Admin** (admins only).
- The Calculator is not in the nav — open it from a batch using **Open in Calculator**.

---

## Features

---

### Dashboard

The first page you see after login. Shows:
- Total workers, sessions, SKUs
- Sessions created per day (last 14 days) — line chart
- SKUs by platform — donut chart

---

### Calculator

The pricing tool. Use it to figure out what price to sell each item at.

**How to open it:** Go to a batch → Stock Items tab → click **Open in Calculator**.

The calculator loads all the items from that batch automatically. A **← Back to Batch** button lets you return when done.

**How to use:**

1. Each row is one product
2. Fill in (or adjust):
   - **Product name** — type or pick from the preset list
   - **Product cost (RM)** — what you paid per unit
   - **Shipping (RM)** — delivery cost for this item
   - **Platform** — where you're selling (Shopee, eBay, etc.)
   - **Platform fee (%)** — auto-filled from platform settings
   - **Desired margin (%)** — your target profit percentage
   - **Qty** — how many units
3. The app instantly calculates:
   - **Selling price** — the price you should list at
   - **Platform fee amount** — what the platform takes
   - **Profit/unit** — your profit per item
   - **Actual margin %** — the real margin you get
   - **Break-even** — minimum price to avoid a loss
   - **Total profit** — profit × quantity

**Summary bar** at the bottom shows totals across all rows.

**Export CSV** — download all results as a spreadsheet.

---

### Admin Panel

Only Admins can access this. Click **Admin** in the nav bar.

---

#### Users

Manage worker accounts.

**Create a worker:**
1. Go to **Admin → Users**
2. Click **Add User**
3. Enter username and password
4. Click Save

**Deactivate a worker** — click Deactivate. Deactivated users cannot log in.

**Reset password** — click Edit on a user and enter a new password.

> You cannot delete Admin accounts. You cannot deactivate your own account.

---

#### Platforms

Manage the selling platforms shown in the calculator.

**Add a platform:**
1. Go to **Admin → Platforms**
2. Click **Add Platform**
3. Fill in:
   - **Slug** — short ID, lowercase letters/numbers only (e.g. `shopee`, `ebay`)
   - **Name** — display name
   - **Fee %** — platform's selling fee (e.g. `12.5` for 12.5%)
   - **Customizable** — tick if users should be able to enter a custom fee per item

**Reorder platforms** — drag to reorder. The order here is the order in the calculator dropdown.

---

#### Partners

Partners are the people who share in the batch profits.

**Add a partner:**
1. Go to **Admin → Partners**
2. Click **Add Partner**
3. Select a user from the dropdown — it shows all users not yet linked as a partner
4. Enter their display name
5. Click Save

> If the dropdown is empty, all existing users are already partners. Create a new user first.

---

#### Batches

Batches are used to track a round of stock purchases and split the profit among partners.

**Full batch workflow:**

---

**Step 1: Create a batch**
1. Go to **Admin → Batches**
2. Click **New Batch**
3. Give it a name (e.g. "March 2026 Stock")
4. Click Save

---

**Step 2: Add stock items**
1. Open the batch (click on it)
2. Go to the **Stock Items** tab
3. Click **Add Item** for each product you bought:
   - **Item name** — select from presets or type a custom name
   - **Quantity** — how many units you bought in total
   - **Unit cost (RM)** — cost per unit (do not include delivery fees — see Batch Overhead Fees below)
   - **Notes** — optional memo
4. Keep adding until all purchased stock is recorded

The summary bar shows:
- Total items / Sold units count
- Total cost (all stock + overhead fees)
- Revenue (from recorded sales)
- Profit so far

**Batch Overhead Fees**

Use the **Batch Overhead Fees** card (below the items table) to record costs that apply to the whole batch, not individual items:

- **Delivery fee (RM)** — postage or courier cost for receiving the stock
- **Other fees (RM)** — any other overhead (packaging, storage, etc.)

Click **Save Fees** after entering values. These fees are added to the total cost automatically, so they are factored into profit and distribution calculations. Leave as 0 if not applicable.

---

**Step 3: Open in Calculator (optional)**

Click **Open in Calculator** to load all batch items into the pricing calculator. Use this to figure out your target selling prices based on cost and desired margin. Click **← Back to Batch** when done.

---

**Step 4: Record sales**

As you sell units, record each sale transaction on the item:

1. Find the item in the **Stock Items** tab
2. Click **Add Sale** (or expand the item to see its sales)
3. Enter:
   - **Qty sold** — how many units in this transaction
   - **Sale price (RM)** — price per unit for this sale
   - **Platform** — which platform you sold on (optional)
   - **Notes** — optional memo
4. Click Save

**You can add multiple sale records per item** — for example, if you sold 80 units at RM10 on Shopee, then later sold 50 units at RM15 on eBay, add two separate sale records. The item shows the total sold quantity vs. total purchased.

To edit or delete a specific sale record, use the Edit / Delete buttons next to it.

---

**Step 5: Set up distribution**

Once you have sales recorded:
1. Go to the **Distribution** tab
2. The gross profit is calculated automatically (revenue from all sales minus cost of all stock and overhead fees)
3. Set how much profit to retain (keep for business expenses):
   - **Fixed amount** — e.g. RM 500 flat
   - **Percentage** — e.g. 20% of gross profit
4. Set each partner's percentage share of the remaining profit
   - The percentages must add up to **exactly 100%**
   - Use the sliders to adjust each partner's share
5. Click **Save Distribution**

The saved distribution shows:
- Total revenue / Total cost / Gross profit / Retained / Distributed — summary cards
- **Revenue by Platform** — breakdown of how much revenue came from each platform (e.g. Shopee: RM 800, TikTok: RM 350)
- Each partner's percentage and calculated payout (RM)
- **Income Slip** button per partner — opens a printable income statement for that partner (useful for income tax or claiming purposes). The slip auto-triggers the print dialog when opened.

---

**Step 6: Close the batch**

When all sales are done and the distribution is finalised:
1. Click **Close Batch**
2. Confirm the action

A closed batch is **locked** — no more changes can be made. This gives you a permanent record for accounting. You can still view and print the distribution.

---

## Tips

- **Unsold stock is counted in costs** — the distribution reflects the true position of the batch, including stock you haven't sold yet. This is intentional.
- **Multiple sale prices** — if you sold some units cheaper and some at a higher price, just add separate sale records. The system sums them all up correctly.
- **You can save distribution multiple times** — it recalculates each time. Only close when you're fully done.
- **Quantity cap** — you cannot record sales totalling more than the purchased quantity for an item. The system will block this.
- **Overhead fees are included in profit** — delivery fee and other fees are subtracted from gross profit automatically. You don't need to manually deduct them.
- **Income slips open in a new window** — your browser may block pop-ups. If nothing happens when clicking Income Slip, allow pop-ups for this site in your browser settings.

---

## Troubleshooting

**"Distribution required before closing"**
→ Go to the Distribution tab and save a distribution first.

**"Cannot modify a closed batch"**
→ The batch has been closed and is now read-only. This is by design.

**"Share percentages must sum to exactly 100"**
→ Check that all partner percentages in the distribution add up to 100.

**"Cannot sell X units — only Y unsold remaining"**
→ You're trying to record a sale of more units than are available. Check existing sale records for this item.

**Partners dropdown is empty when adding a partner**
→ All existing users are already linked as partners, or there are no users. Create a new user account first under Admin → Users.

**Logged out unexpectedly**
→ Your session expired. Log in again. Sessions last 15 minutes but auto-renew while you're active.

**Calculator shows "Enter product cost to calculate"**
→ Product cost must be greater than 0.

**Calculator shows "Platform fee + desired margin ≥ 100%"**
→ Reduce your desired margin or check that the platform fee is correct.
