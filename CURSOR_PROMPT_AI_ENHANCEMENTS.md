# 🎯 Cursor Prompt: Enhance AI Endpoints with Canadian Stocks

## Objective
Improve existing AI endpoints in `/app/api/ai/*` folder by:
1. Adding Canadian stocks (TSX tickers) to all stock lists
2. Adding Canadian news sources to `/app/api/news/route.ts`
3. Making small accuracy improvements (better wording, realistic data)
4. **DO NOT change any core logic, structure, or API response shapes**

---

## ✅ CRITICAL RULES

### ❌ DO NOT:
- Rewrite or replace any existing functions
- Change API response structure (keys, fields, order)
- Modify React components
- Add new libraries or dependencies
- Refactor code structure
- Change status codes or error handling
- Add new features or endpoints

### ✅ DO:
- Add Canadian stocks to existing arrays/lists
- Improve text descriptions (more realistic, better wording)
- Fix unrealistic numbers (percentages, yields, volatility)
- Add Canadian news sources to news API
- Keep all existing U.S. stocks
- Mix Canadian and U.S. stocks naturally in lists

---

## 📋 Endpoints to Update

### 1. `/app/api/ai/quick-insights/route.ts`
- Add Canadian stocks to the "3 tickers to watch" section
- Mix TSX and U.S. tickers naturally
- Improve market snapshot wording

### 2. `/app/api/ai/recommended/route.ts`
- Add Canadian stocks to recommended list (5-10 names)
- Include TSX tickers with reason tags (upgrade, breakout, volume)
- Keep existing U.S. stocks

### 3. `/app/api/ai/technical/route.ts`
- Add Canadian stocks to technical analysis
- Ensure per-ticker analysis includes TSX symbols
- Keep existing format: trend, SR levels, patterns, momentum score

### 4. `/app/api/ai/should-buy/route.ts`
- Add Canadian stocks to "Should I Buy?" analysis
- Include TSX tickers with verdict: thesis, entry/exit, risks
- Keep existing response structure

### 5. `/app/api/ai/research/route.ts` (if exists)
- Add Canadian stocks to research results
- Include TSX tickers in company cards
- Keep format: snapshot, financials, catalysts, filings

### 6. `/app/api/ai/top-picks/route.ts`
- Add Canadian stocks to all themes (Value, Quality, Momentum, Dividend)
- Mix TSX and U.S. tickers in each category
- Keep existing weekly list format

### 7. `/app/api/ai/value/route.ts`
- Add Canadian value stocks
- Include TSX tickers in "best value" list
- Keep existing format

### 8. `/app/api/ai/momentum/route.ts`
- Add Canadian stocks to momentum analysis
- Include TSX tickers in "strongest momentum" list
- Keep existing format

### 9. `/app/api/ai/dividend/route.ts` (if exists)
- Add Canadian dividend stocks
- Include TSX tickers with high yields
- Keep existing format

### 10. `/app/api/ai/rebound/route.ts` (undervalued rebound)
- Add Canadian stocks to rebound candidates
- Include TSX tickers that are undervalued
- Keep existing format

### 11. `/app/api/ai/stable-growth/route.ts`
- Add Canadian stocks to stable growth picks
- Include TSX tickers with low beta, consistent EPS
- Keep existing format

### 12. `/app/api/ai/strongest-today/route.ts`
- Add Canadian stocks to strongest today
- Include TSX tickers with strong relative strength and volume
- Keep existing format

### 13. `/app/api/news/route.ts`
- Add Canadian news sources:
  - Yahoo Finance Canada
  - BNN Bloomberg
  - Financial Post
  - Globe & Mail (Business)
  - MarketWatch (Canadian section)
- Keep existing U.S. news sources
- Ensure Canadian stock symbols (e.g., RY.TO, TD.TO) fetch Canadian news

---

## 🇨🇦 Canadian Stocks to Include

### Major TSX Tickers:
- **Banks**: RY.TO, TD.TO, BNS.TO, CM.TO, BMO.TO, NA.TO
- **Energy**: ENB.TO, TRP.TO, SU.TO, CNQ.TO, CVE.TO, IMO.TO
- **Tech**: SHOP.TO, OTEX.TO, LSPD.TO, CSU.TO
- **Telecom**: BCE.TO, T.TO, RCI.TO, QBR.TO
- **Utilities**: FTS.TO, ALA.TO, CU.TO
- **Real Estate**: REI.UN.TO, CAR.UN.TO, IIP.UN.TO
- **Mining**: ABX.TO, G.TO, NTR.TO, WPM.TO
- **Other**: BAM.TO, CP.TO, CNR.TO, ATD.TO, WCN.TO

### Mixing Strategy:
- In lists of 5-10 stocks: Include 2-4 Canadian stocks
- In lists of 3 stocks: Include 1 Canadian stock
- Vary which Canadian stocks appear (don't always use the same ones)
- Match Canadian stocks to appropriate categories (e.g., RY.TO in dividend/value, SHOP.TO in momentum/tech)

---

## ✨ Small Improvements to Make

### 1. More Realistic Numbers:
- **Dividend yields**: 2-6% (not 0% or 10%+)
- **Price changes**: ±0.5% to ±5% (not always 0.00%)
- **Momentum scores**: 60-95 (not 100 or 0)
- **Volatility**: 15-35% (not 0% or 80%)
- **P/E ratios**: 8-25 (not 0 or 100+)

### 2. Better Descriptions:
- Instead of: "Good stock"
- Use: "High EPS stability with consistent dividend growth"
- Instead of: "Undervalued"
- Use: "Undervalued vs sector peers, trading below 5-year average P/E"
- Instead of: "Breakout"
- Use: "Breakout from 3-month consolidation pattern with volume confirmation"

### 3. More Specific Details:
- Add specific percentages: "5.2% dividend yield"
- Add timeframes: "Up 12% over past 3 months"
- Add comparisons: "Trading 15% below sector average"
- Add catalysts: "Earnings beat expectations by 8%"

### 4. Natural Language:
- Keep descriptions simple and readable
- Avoid jargon unless necessary
- Use active voice: "Stock shows strong momentum" not "Momentum is strong for stock"

---

## 🔍 How to Find Files

1. Look in `/app/api/ai/` folder
2. Each endpoint has its own folder with `route.ts`
3. Check `/app/api/news/route.ts` for news endpoint
4. Read existing code to understand structure
5. Only modify the data arrays and text strings
6. Do NOT modify function signatures or response shapes

---

## 📝 Example Changes

### Before:
```typescript
stocks: ['AAPL', 'MSFT', 'GOOGL']
description: "Good momentum stock"
```

### After:
```typescript
stocks: ['AAPL', 'MSFT', 'SHOP.TO', 'GOOGL', 'RY.TO']
description: "Strong momentum with 15% gain over past month, breakout from consolidation pattern"
```

### News API Before:
```typescript
sources: ['Yahoo Finance', 'MarketWatch']
```

### News API After:
```typescript
sources: ['Yahoo Finance', 'MarketWatch', 'Yahoo Finance Canada', 'BNN Bloomberg', 'Financial Post', 'Globe & Mail (Business)', 'MarketWatch (Canadian section)']
```

---

## ✅ Verification Checklist

After making changes, verify:
- [ ] All endpoints still return same response structure
- [ ] Canadian stocks appear in all relevant lists
- [ ] U.S. stocks still appear (not replaced)
- [ ] Numbers are more realistic
- [ ] Descriptions are improved but still readable
- [ ] News API includes Canadian sources
- [ ] No TypeScript errors
- [ ] No broken imports
- [ ] Frontend still works (same keys/fields)

---

## 🎯 Summary

**Goal**: Add Canadian stocks and improve accuracy WITHOUT changing logic or structure.

**Method**: 
1. Find stock arrays/lists in each endpoint
2. Add Canadian tickers (mix with U.S. stocks)
3. Improve text descriptions
4. Fix unrealistic numbers
5. Add Canadian news sources to news API

**Constraint**: Keep everything backward-compatible with frontend.

---

**Start with one endpoint, test it works, then move to the next.**

