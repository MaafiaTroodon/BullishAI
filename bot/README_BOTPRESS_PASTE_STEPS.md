# Botpress Integration Steps

Follow these steps to configure BullishAI Market Analyst in Botpress.

## Prerequisites

- Botpress account with webchat configured
- Tools enabled and named exactly: `getQuote`, `getNews`, `getFundamentals`
- HTTP tools configured to call your API endpoints:
  - `/api/quote` (returns quote data)
  - `/api/news` (returns news articles)
  - `/api/fundamentals` (returns fundamental data)

## Step-by-Step Setup

### 1. Knowledge Bases

Go to Botpress → Knowledge Bases.

#### Add Rich Text Document — Style Guide
- Click "Add Knowledge" → Rich Text
- Title: "Style Guide"
- Content: Paste contents of `bot/style_guide.md`
- Save

#### Add Rich Text Document — Scope Policy  
- Click "Add Knowledge" → Rich Text
- Title: "Scope Policy"
- Content: Paste contents of `bot/scope_policy.md`
- Save

#### Add CSV Document — Ticker Map
- Click "Add Knowledge" → Document
- Title: "Ticker Map"
- Upload: `bot/ticker_map.csv`
- Save

### 2. Instructions

Go to Botpress → Instructions.

#### Main Instructions
- Clear existing content
- Paste full contents of `bot/instructions.md`
- Save

#### Add Examples Section
- Scroll to bottom of Instructions
- Add new section "## Examples"
- Paste full contents of `bot/few_shots.md`
- Save

### 3. Variables

Go to Botpress → Variables.

#### Create conversation.lastTicker
- Click "Add Variable"
- Name: `lastTicker`
- Parent: `conversation`
- Type: `string`
- Default: `""`
- Save

### 4. Verify Tools

Go to Botpress → Tools.

Ensure these three tools exist and are enabled:
- ✅ `getQuote` → calls `/api/quote`
- ✅ `getNews` → calls `/api/news`
- ✅ `getFundamentals` → calls `/api/fundamentals`

### 5. Test Queries

Use Botpress → Preview to test:

1. **Price query**: "what's the current price of AAPL"
   - Should call `getQuote(AAPL)`
   - Should show formatted price with day range and 52W

2. **News query**: "show me amazon news"
   - Should detect AMZN alias
   - Should call `getNews(AMZN, 5)`
   - Should list 3-5 headlines

3. **Technical query**: "is NVDA overbought"
   - Should call `getQuote(NVDA)`
   - Should analyze from %change + 52W
   - Should include disclaimer

4. **Follow-up**: "what about news?"
   - Should reuse `conversation.lastTicker` (NVDA)
   - Should call `getNews(NVDA, 5)`

5. **Fundamentals**: "tesla fundamentals"
   - Should call `getFundamentals(TSLA)`
   - Should show P/E, EPS, Mkt Cap, metrics

6. **Off-scope**: "book me a flight"
   - Should politely refuse
   - Should suggest market topics

## Troubleshooting

### Replies Don't Call Tools

1. Check Tool mappings in Botpress are correct
2. Verify `/api/*` routes return expected JSON
3. Re-check Instructions for tool invocation syntax
4. Test HTTP tools independently in Botpress

### Incorrect Ticker Detection

1. Update `ticker_map.csv` with more aliases
2. Re-upload to Knowledge Bases
3. Check ticker inference logic in Instructions

### Off-scope Responses

1. Verify Scope Policy is in Knowledge Bases
2. Check scope guardrails in Instructions
3. Add more off-scope examples in few_shots.md

### Memory Not Persisting

1. Verify `conversation.lastTicker` variable exists
2. Check Variable scope (conversation vs user)
3. Ensure Instructions reference `conversation.lastTicker` correctly

## Final Checklist

- ✅ Instructions.md pasted to Botpress Instructions
- ✅ few_shots.md added to Instructions as "Examples" section
- ✅ style_guide.md added as Rich Text KB
- ✅ scope_policy.md added as Rich Text KB
- ✅ ticker_map.csv uploaded as Document KB
- ✅ conversation.lastTicker variable created
- ✅ Three tools enabled: getQuote, getNews, getFundamentals
- ✅ All test queries pass
- ✅ Disclaimers appear on investment advice
- ✅ Off-scope handled politely

You're done! The Botpress chat is now configured as BullishAI Market Analyst.

