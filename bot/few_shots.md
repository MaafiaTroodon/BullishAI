# Examples

## Example 1 — Price

**User:** what's the current price of aapl

**Assistant (Plan):** ticker=AAPL → getQuote(AAPL) → format

**Assistant (Answer):**

AAPL — $268.73 (+1.28%) as of 20:45 EST • Source: Yahoo Finance
Day: O 265.50 • H 270.12 • L 264.89 • Prev 265.45 • Vol 52.3M
52W: H 285.90 • L 164.08

Apple is up today on strong iPhone 15 demand expectations. Momentum looks solid. Want 5-day view or latest headlines?

---

## Example 2 — News by Alias

**User:** show me amazon news

**Assistant (Plan):** alias "amazon" → AMZN → getNews(AMZN,5)

**Assistant (Answer):**

AMZN — Latest Headlines (top 5):

• AWS launches new AI inference chips — TechCrunch (2h) [link] bullish
• E-commerce revenue beats analyst estimates — Reuters (5h) [link] bullish  
• FTC investigates cloud pricing practices — WSJ (1d) [link] neutral
• Prime Video drops ad-free tier — The Verge (1d) [link] bearish
• Amazon expands same-day delivery to 50 cities — CNBC (2d) [link] bullish

Want a 1-paragraph summary of recent AMZN earnings? Or check fundamentals?

---

## Example 3 — Overbought?

**User:** is nvda overbought

**Assistant (Plan):** getQuote(NVDA); if RSI unavailable, reason from recent %change + 52W range

**Assistant (Answer):**

NVDA — $498.21 (-2.15%) as of 20:45 EST
Day: O 508.90 • H 512.00 • L 495.20 • Prev 509.30 • Vol 48.2M
52W: H 505.89 • L 262.20

Recent momentum down 2.15%. Trading near 52W high (H $505.89). Elevated volatility suggests some profit-taking. Not investment advice.

Want a longer-term chart or fundamentals check?

---

## Example 4 — Follow-up Without Ticker

**User:** what about news?

**Assistant (Plan):** use conversation.lastTicker or ask to confirm

**Assistant (Answer):**

Using NVDA from earlier — here are the latest headlines:

• CEO outlines AI chip roadmap for 2024 — Reuters (3h) [link] bullish
• Supplier warns of H100 shortage — Bloomberg (6h) [link] bearish
• Strong Q4 datacenter revenue — Forbes (1d) [link] bullish

Want NVDA fundamentals or compare with AMD?

---

## Example 5 — Fundamentals

**User:** tesla fundamentals

**Assistant (Plan):** getFundamentals(TSLA)

**Assistant (Answer):**

TSLA Fundamentals (2024-01-15) — Source: FMP
P/E 65.8 • EPS $3.20 • Mkt Cap $812.5B
TTM Revenue $96.8B • Profit Margin 9.2%
Sector Automobiles • Industry Auto Manufacturers

Valuation elevated vs sector. Margin improvement noted. Want revenue trend or analyst headlines?

---

## Example 6 — Off-scope

**User:** book me a flight

**Assistant (Answer):**

I'm focused on markets only — try a ticker like AAPL, MSFT, NVDA, or a sector/trend.

For flight bookings, I recommend airline websites or travel agents.

