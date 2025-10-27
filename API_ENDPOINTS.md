# BullishAI API Endpoints

This document describes the three public API endpoints for fetching live stock data, news, and fundamentals.

## Overview

All endpoints follow a consistent pattern:
- **Method**: GET
- **Response Format**: `{ ok: boolean, data?: T, error?: string }`
- **Caching**: 15-60 seconds depending on endpoint
- **Fallback**: Multiple data providers (Finnhub → TwelveData → Yahoo)
- **CORS**: Enabled for all origins

## Endpoints

### 1. Quote API

Get current stock price, change, and trading data.

**Endpoint**: `/api/quote`

**Query Parameters**:
- `ticker` (required): Stock symbol (e.g., "AAPL", "amazon" → AMZN)

**Example Request**:
```
GET https://bullishai.netlify.app/api/quote?ticker=AAPL
```

**Example Response**:
```json
{
  "ok": true,
  "data": {
    "symbol": "AAPL",
    "price": 267.75,
    "changePct": 1.87,
    "open": 265.95,
    "high": 267.79,
    "low": 264.65,
    "prevClose": 262.82,
    "volume": 28400000,
    "fiftyTwoWkHigh": 267.79,
    "fiftyTwoWkLow": 169.21,
    "asOf": "2025-10-27T15:45:10.000Z",
    "source": "yahoo"
  }
}
```

**Cache**: 15 seconds
**Error Response**: `{ ok: false, error: "message" }`

---

### 2. News API

Get recent news articles for a stock.

**Endpoint**: `/api/news`

**Query Parameters**:
- `ticker` (required): Stock symbol
- `limit` (optional): Number of articles (1-20, default: 5)

**Example Request**:
```
GET https://bullishai.netlify.app/api/news?ticker=AMZN&limit=3
```

**Example Response**:
```json
{
  "ok": true,
  "data": [
    {
      "symbol": "AMZN",
      "headline": "Amazon beats Q3 earnings expectations",
      "source": "Reuters",
      "url": "https://...",
      "publishedAt": "2025-10-27T14:58:00.000Z",
      "sentiment": "positive"
    }
  ]
}
```

**Cache**: 30 seconds
**Error Response**: `{ ok: false, error: "message" }`

---

### 3. Fundamentals API

Get fundamental financial metrics for a stock.

**Endpoint**: `/api/fundamentals`

**Query Parameters**:
- `ticker` (required): Stock symbol

**Example Request**:
```
GET https://bullishai.netlify.app/api/fundamentals?ticker=TSLA
```

**Example Response**:
```json
{
  "ok": true,
  "data": {
    "symbol": "TSLA",
    "pe": 68.4,
    "eps": 4.21,
    "marketCap": 780000000000,
    "revenueTTM": null,
    "profitMargin": null,
    "sector": "Consumer Discretionary",
    "industry": "Auto Manufacturers",
    "asOf": "2025-10-27T15:40:00.000Z",
    "source": "twelvedata"
  }
}
```

**Cache**: 60 seconds
**Error Response**: `{ ok: false, error: "message" }`

---

## Symbol Normalization

The API automatically normalizes ticker symbols from natural language:

- `"apple"` → `"AAPL"`
- `"amazon"` → `"AMZN"`
- `"nvidia"` → `"NVDA"`
- `"tesla"` → `"TSLA"`

See `lib/market/symbols.ts` for the full alias map.

---

## Environment Variables

Required in `.env.local`:

```bash
FINNHUB_API_KEY=your_finnhub_key
TWELVEDATA_API_KEY=your_twelvedata_key

# Optional
NEXT_PUBLIC_APP_URL=https://bullishai.netlify.app
```

---

## Testing

Run smoke tests locally:

```bash
node scripts/smoke.js
```

Or test manually:

```bash
curl https://bullishai.netlify.app/api/quote?ticker=AAPL
curl https://bullishai.netlify.app/api/news?ticker=AMZN&limit=5
curl https://bullishai.netlify.app/api/fundamentals?ticker=TSLA
```

---

## Rate Limits

- Quote: ~15 req/s (cached 15s)
- News: ~10 req/s (cached 30s)
- Fundamentals: ~5 req/s (cached 60s)

---

## Data Providers

The API uses a fallback chain:

1. **Finnhub** (primary) - Free tier: 60 calls/minute
2. **TwelveData** (secondary) - Free tier: 8 calls/day, 800/month
3. **Yahoo Finance** (fallback) - No auth required

All providers are called in parallel; the first successful response is returned.

---

## Botpress Integration

These endpoints are designed for use with Botpress AI chatbot:

1. Add three HTTP Tools in Botpress
2. Use the URLs above as tool endpoints
3. Botpress will automatically call these when users ask about stocks

Example Botpress tool configuration:
```
Tool: getQuote
Method: GET
URL: https://bullishai.netlify.app/api/quote?ticker={{inputs.ticker}}
Inputs: { "ticker": "string" }
```

