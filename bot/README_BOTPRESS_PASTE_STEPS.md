# Botpress Setup Instructions

Follow these steps to configure BullishAI's Botpress agent:

## Prerequisites
- Botpress account with webchat access
- API endpoints deployed at https://bullishai.netlify.app
- Tools configured: getQuote, getNews, getFundamentals

## Step 1: Configure Knowledge Bases

### A. Add Rich Text Documents

1. Go to Botpress → **Knowledge Bases**
2. Click **Add Document** → Select **Rich Text**
3. Name it: "Style Guide"
4. Paste contents of `bot/style_guide.md`
5. Click **Save**

Repeat for:
- Name: "Scope Policy" → paste `bot/scope_policy.md`

### B. Add CSV Document

1. Click **Add Document** → Select **Document**
2. Name it: "Ticker Map"
3. Upload `bot/ticker_map.csv`
4. Set chunking: 400-600, overlap: 60-100
5. Enable Re-ranking
6. Click **Save**

## Step 2: Configure System Instructions

1. Go to Botpress → **Instructions**
2. Delete existing content
3. Paste contents of `bot/instructions.md`
4. Scroll to bottom
5. Add section: "## Examples"
6. Paste contents of `bot/few_shots.md` under Examples
7. Click **Save**

## Step 3: Verify Tools

1. Go to Botpress → **Tools**
2. Verify three HTTP Tools exist:
   - **getQuote**: GET https://bullishai.netlify.app/api/quote?ticker={{inputs.ticker}}
   - **getNews**: GET https://bullishai.netlify.app/api/news?ticker={{inputs.ticker}}&limit={{inputs.limit||5}}
   - **getFundamentals**: GET https://bullishai.netlify.app/api/fundamentals?ticker={{inputs.ticker}}

3. Ensure Tools are **Enabled**
4. If missing, create them with correct URLs and input schemas

## Step 4: Create Variables

1. Go to Botpress → **Variables**
2. Click **Create Variable**
3. Name: `conversation.lastTicker`
4. Type: String
5. Default: "" (empty)
6. Click **Save**

## Step 5: Test Queries

Use these test queries to verify behavior:

### Test 1: Price Query
**User:** what's the current price of aapl
**Expected:** Bot calls getQuote(AAPL) and returns formatted quote

### Test 2: News by Alias
**User:** show me amazon news
**Expected:** Bot normalizes "amazon" → AMZN, calls getNews(AMZN), returns headlines

### Test 3: Overbought Check
**User:** is nvda overbought
**Expected:** Bot calls getQuote(NVDA), provides analysis with disclaimer

### Test 4: Follow-up
**User:** what about news?
**Expected:** Bot uses conversation.lastTicker (NVDA) and returns news

### Test 5: Fundamentals
**User:** tesla fundamentals
**Expected:** Bot calls getFundamentals(TSLA) and returns formatted data

### Test 6: Off-Scope
**User:** book me a flight
**Expected:** Bot politely declines and redirects to allowed topics

## Troubleshooting

### Bot Doesn't Call Tools
1. Verify Tools are enabled in Botpress
2. Check API endpoint URLs are correct
3. Test endpoints manually (e.g., curl https://bullishai.netlify.app/api/quote?ticker=AAPL)
4. Check Instructions mention tool names explicitly

### Wrong Responses
1. Verify Knowledge Bases are activated
2. Check chunking settings in Ticker Map
3. Review Instructions for formatting rules
4. Check few-shot examples match desired output

### Missing Variables
1. Ensure conversation.lastTicker is created
2. Verify it's accessible in Instructions
3. Check variable is updated in tool responses

## Post-Setup Checklist
- [ ] Knowledge bases uploaded (Style Guide, Scope Policy, Ticker Map)
- [ ] Instructions updated with system prompt and examples
- [ ] Three HTTP Tools configured and enabled
- [ ] conversation.lastTicker variable created
- [ ] All 6 test queries pass
- [ ] Bot declines off-topic requests politely
- [ ] Bot includes disclaimers for buy/sell questions
- [ ] Output formatting matches style guide

## Deployment Notes
- API endpoints cache responses 15-60s
- Rate limits: ~60 calls/min (Finnhub), ~8/day (TwelveData)
- Fallback chain: Finnhub → TwelveData → Yahoo
- All endpoints return { ok: boolean, data?, error? }

## Support
If bot still doesn't work after following all steps:
1. Check Botpress logs for errors
2. Verify API endpoints are responding
3. Review few-shot examples match Instructions format
4. Test variable assignment in conversation flow
5. Check KB re-ranking is enabled

