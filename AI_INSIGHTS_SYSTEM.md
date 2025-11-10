# AI Insights System - Complete Integration

## Overview

The AI Insights system provides real-time market analysis through an interactive toolbar with 18 pre-configured cards across 3 sections. All cards fetch live market data and update automatically.

## Architecture

### Left Toolbar (`components/AIInsightsToolbar.tsx`)

Three collapsible sections:
1. **Quick Insights** (6 cards) - Market snapshots, breadth, news movers
2. **Today's Recommended Stocks** (6 cards) - Upgrades, breakouts, screeners
3. **Technical Analysis** (6 cards) - Trends, patterns, momentum, risk/reward

### Card System

Each card is defined in `/public/configs/ai_insights_presets.json` with:
- `data_fetch`: Array of API endpoints to call
- `compute`: Pure TypeScript function to process data
- `render`: Component to display results
- `refresh_ms`: Auto-refresh interval (20-60s)
- `cache_ttl_ms`: Stale-while-revalidate cache time

### Real-Time Updates

- Uses SWR with `refreshInterval` and `staleTime`
- Cards update automatically without blocking UI
- No flickering (stale-while-revalidate pattern)
- Per-user caching with userId in keys

## API Endpoints Created

### Market Data
- `/api/market/breadth` - Advancing/declining, volume ratios
- `/api/market/top-movers` - Top movers by absolute change
- `/api/market/sector-momentum` - Sector ETF performance

### News & Events
- `/api/news/movers` - News headlines for top movers
- `/api/calendar/earnings` - Earnings calendar (today/upcoming)

### Screeners
- `/api/screeners/unusual-volume` - Volume > 1.5x average
- `/api/screeners/highs` - 52-week highs with volume
- `/api/screeners/value-quality` - PE<15, ROE>15%, Rev>10%
- `/api/screeners/momentum` - 5-day momentum leaders
- `/api/screeners/rebound` - RSI<35 turning up
- `/api/screeners/dividend-momentum` - Yield≥2% + high RS

### Analyst Data
- `/api/analyst/upgrades` - Recent analyst upgrades

### Technical Data
- `/api/ohlc?symbol=...&tf=...` - OHLC candles (1h/1d/1w)
- `/api/metrics/volatility?symbol=...` - Volatility metrics

## Card Components

### InsightCard
- Paragraph summary + 3 bullets
- Optional sparkline
- Top 3 tickers grid

### HeatmapGrid
- 2x2 or 4x4 grid of metrics
- Color-coded (green/red) for positive/negative

### RankedList
- Numbered list (1-10)
- Shows change %, rating, targets

### Table
- Sortable columns
- Configurable fields

### SparkTable
- Table with sparklines
- Implied moves, RSI, trends

### BadgeGrid
- 2x3 or 3x3 grid of badges
- Volume ratios, 52W highs

### TAOverview
- SMA levels (20/50/200)
- Support/resistance pivots

### GaugesRow
- RSI, MACD, Stochastic
- 52W high/low distances

### RRCard
- Entry/stop/target
- Risk/reward ratio
- Risk percentage

### AlignmentMeters
- Multi-timeframe alignment
- 1h/1d/1w trend strength

### InlineNote
- Risk warnings
- Key risks list
- Disclaimer

## Integration Points

### Chat Interface
- Toolbar appears above chat when expanded
- Cards render in dedicated area
- Chat remains functional below

### Standalone Page
- `/ai/insights` - Full-screen insights dashboard
- Can filter by symbol via query param

### Data Flow

1. User clicks card button
2. Toolbar fetches data from `data_fetch` endpoints
3. Runs `compute` function to process
4. If `model_routing` specified, calls AI for summary
5. Renders using specified component
6. Auto-refreshes on `refresh_ms` interval

## Current Market Data

All endpoints use:
- Internal `/api/quotes` for real-time prices
- Internal `/api/chart` for OHLC data
- Internal `/api/news` for headlines
- Market data providers (TwelveData, Finnhub) via existing libs

## Example Usage

```typescript
// User clicks "Market Snapshot" card
// System:
// 1. Fetches /api/quotes?symbols=SPY,QQQ,DIA,IWM,VIX,DXY
// 2. Fetches /api/market/breadth
// 3. Fetches /api/news/movers?limit=5
// 4. Runs merge_quotes_and_breadth()
// 5. Calls Groq with context for summary
// 6. Renders InsightCard with AI summary + bullets + tickers
// 7. Auto-refreshes every 60s
```

## Next Steps

1. **Enhance Compute Functions**: Add more sophisticated calculations
2. **Vector DB Integration**: Index news/filings for better RAG
3. **Pattern Detection**: Implement actual technical pattern recognition
4. **Real Analyst Data**: Integrate with analyst upgrade API
5. **Options Flow**: Add options data provider
6. **Earnings Calendar**: Connect to real earnings calendar API

## Files Created

- `public/configs/ai_insights_presets.json` - Card configurations
- `components/AIInsightsToolbar.tsx` - Main toolbar component
- `app/ai/insights/page.tsx` - Standalone insights page
- `app/api/market/*` - Market data endpoints
- `app/api/screeners/*` - Stock screener endpoints
- `app/api/analyst/*` - Analyst data endpoints
- `app/api/calendar/*` - Calendar endpoints
- `app/api/metrics/*` - Technical metrics endpoints

All endpoints return current market data and integrate with existing market data providers.

