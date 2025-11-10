# Real-Time Mark-to-Market Portfolio Valuation - Complete

## Summary
Implemented real-time mark-to-market portfolio valuation similar to TradingView. Portfolio values now update with live market prices, and the chart displays TPV (Total Portfolio Value) over time.

## Implementation

### 1. Mark-to-Market Calculation (`lib/portfolio-mark-to-market.ts`)
- **`calculateMarkToMarket()`**: Fetches live prices for all holdings and calculates:
  - TPV (Total Portfolio Value) = Σ (shares × current_price)
  - Cost Basis = Σ (shares × avg_price)
  - Total Return = TPV - Cost Basis
  - Return % = (Total Return / Cost Basis) × 100
- **`savePortfolioSnapshot()`**: Saves TPV snapshots to database for historical charts
- **`getPortfolioTimeSeries()`**: Retrieves historical TPV data for chart display

### 2. Database Schema
- **`portfolio_snapshots` table**: Stores time-series TPV data
  - Columns: `userId`, `timestamp`, `tpv`, `walletBalance`, `costBasis`, `totalReturn`, `totalReturnPct`, `details` (JSONB)
  - Indexed on `userId` and `timestamp` for efficient queries
  - Migration file: `prisma/migrations/20251110000000_add_portfolio_snapshots/migration.sql`

### 3. API Endpoints Updated

#### `GET /api/portfolio?enrich=1`
- Now uses `calculateMarkToMarket()` for real-time valuation
- Returns `totals` object with:
  - `tpv`: Total Portfolio Value (mark-to-market)
  - `costBasis`: Total cost basis
  - `totalReturn`: Total return in dollars
  - `totalReturnPct`: Total return percentage
- Saves snapshot to database asynchronously (non-blocking)
- Holdings include `currentPrice`, `marketValue`, `unrealizedPnl`, `unrealizedPnlPct`

#### `POST /api/portfolio` (buy/sell)
- After trade, calculates mark-to-market totals
- Returns complete snapshot with `totals` object
- Saves snapshot to database
- Client receives fresh TPV immediately

#### `GET /api/portfolio/timeseries`
- Now uses `getPortfolioTimeSeries()` to fetch historical snapshots
- Merges snapshots with current live TPV
- Returns series with `portfolio` (TPV) values for chart

### 4. Components Updated

#### `PortfolioSummary.tsx`
- Uses `data.totals` from API (mark-to-market) if available
- Falls back to client-side calculation if totals not available
- Refresh interval: 20s during market hours (REG/PRE/POST), 60s when closed
- Displays real-time TPV, cost basis, total return, return %

#### `PortfolioChart.tsx`
- Uses `portfolio` (TPV) from timeseries snapshots
- Refresh interval: 20s during market hours
- Chart shows TPV over time (X = timestamp, Y = TPV)
- Updates in real-time as prices change

#### `DemoTradeBox.tsx`
- Uses `totals` from trade response for immediate update
- Updates SWR cache with mark-to-market data

#### `GlobalNavbar.tsx`
- Wallet balance cleared on logout (already fixed)

### 5. Price Polling & Refresh Intervals

**Market Hours (REG/PRE/POST)**:
- Portfolio API: 20 seconds
- Timeseries API: 20 seconds
- Real-time price updates for mark-to-market

**Market Closed (OVERNIGHT/CLOSED)**:
- Portfolio API: 60 seconds
- Timeseries API: 60 seconds
- Prices frozen (last close price)

### 6. Console Errors Fixed

#### `api/_debug` 404
- Added AbortController to handle cleanup
- Gracefully handles 404 errors
- Only fetches in development mode

#### TradingView `querySelector` null
- Already fixed with defensive checks in `TradingViewAdvancedChart.tsx`
- Guards with `typeof window !== 'undefined'`
- Cleanup on unmount

## Data Flow

```
User Action / Poll Timer
  ↓
GET /api/portfolio?enrich=1
  ↓
calculateMarkToMarket(positions, walletBalance)
  ↓
Fetch live prices for all symbols (parallel)
  ↓
Calculate TPV = Σ (shares × current_price)
  ↓
Save snapshot to portfolio_snapshots (async)
  ↓
Return { items, totals: { tpv, costBasis, totalReturn, totalReturnPct } }
  ↓
Client updates UI (PortfolioSummary, Chart, Navbar)
```

## Example: $100 Investment → +1.25% Market

1. **Initial**: Invest $100 in AAPL at $150/share = 0.6667 shares
2. **Market +1.25%**: AAPL price = $151.875
3. **TPV Calculation**:
   - Market Value = 0.6667 × $151.875 = $101.25
   - Cost Basis = 0.6667 × $150 = $100.00
   - Total Return = $101.25 - $100.00 = **$1.25**
   - Return % = ($1.25 / $100) × 100 = **1.25%**
4. **Chart**: Adds point at current time with TPV = $101.25
5. **Dashboard**: Shows TPV = $101.25, Return = +$1.25 (+1.25%)

## Database Migration

To create the `portfolio_snapshots` table, run:
```bash
# Option 1: Using Prisma (if available)
npx prisma migrate dev

# Option 2: Direct SQL
psql $DATABASE_URL -f scripts/create-portfolio-snapshots-table.sql
```

The table will be created automatically on first snapshot save if it doesn't exist (with a warning).

## Testing Checklist

- ✅ Portfolio API returns `totals` with mark-to-market TPV
- ✅ Holdings show live prices and unrealized P/L
- ✅ Chart displays TPV over time from snapshots
- ✅ During market hours, values update every 20s
- ✅ After buy/sell, totals reflect new mark-to-market values
- ✅ No $0 flicker during navigation
- ✅ Logout clears all cached data
- ✅ Console errors fixed (api/_debug, TradingView)

## Next Steps (Optional)

1. **Optimize snapshot frequency**: Only save snapshots when TPV changes >0.1% or every 60s
2. **Add extended hours support**: Include pre/post-market prices if provider supports it
3. **Historical data backfill**: Migrate existing portfolio data to snapshots
4. **Performance**: Batch price fetches for multiple users in background jobs

## Deliverable

✅ **Real-time mark-to-market portfolio valuation**
- TPV updates with live prices every 20s during market hours
- Chart shows TPV over time (X = timestamp, Y = TPV)
- Total Return and Return % calculated from cost basis vs market value
- Example: $100 investment → +1.25% market → TPV = $101.25, Return = +$1.25 (+1.25%)
- All numbers unified across dashboard, navbar, holdings, and chart
- No flicker, no races, data persists in database

