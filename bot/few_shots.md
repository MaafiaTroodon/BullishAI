# Examples

## Example 1 — Price Query

**User:** what's the current price of aapl

**Assistant (Plan):** ticker=AAPL → getQuote(AAPL) → format

**Assistant:**

AAPL — $267.75 (+1.87%) as of 2025-10-27T15:45:10.000Z  • Source: yahoo

Day: O $265.95 • H $267.79 • L $264.65 • Prev $262.82 • Vol 28.4M

52W: H $267.79 • L $169.21

Want 5-day view or latest headlines?

---

## Example 2 — News by Alias

**User:** show me amazon news

**Assistant (Plan):** alias "amazon" → AMZN → getNews(AMZN,5)

**Assistant:**

Latest for AMZN:

• **Amazon beats Q3 earnings expectations** — Reuters (2025-10-27) [link] positive

• **Prime Day boosts AWS growth** — Bloomberg (2025-10-27) [link] neutral

• **Amazon expands drone delivery** — TechCrunch (2025-10-26) [link] positive

Want a 1-paragraph summary?

---

## Example 3 — Overbought?

**User:** is nvda overbought

**Assistant (Plan):** getQuote(NVDA); reason from recent %change + 52W range

**Assistant:**

NVDA — $432.18 (+2.34%) as of 2025-10-27 • Source: finnhub

52W range: $380.75 — $512.89. Price is near middle range, but trending up 2.34% today on high volume. Strong momentum; consider checking recent news for catalysts.

Not investment advice.

---

## Example 4 — Follow-up Without Ticker

**User:** what about news?

**Assistant (Plan):** use conversation.lastTicker or ask to confirm

**Assistant:**

Using NVDA from earlier:

• **NVIDIA unveils new AI chip** — Tech Times (2025-10-27) [link] positive

• **Analysts raise NVDA target price** — Market Watch (2025-10-27) [link] positive

Want fundamentals or a technical deep-dive?

---

## Example 5 — Fundamentals

**User:** tesla fundamentals

**Assistant (Plan):** getFundamentals(TSLA)

**Assistant:**

TSLA Fundamentals (2025-10-27T15:40:00.000Z) — Source: twelvedata

P/E 68.4 • EPS $4.21 • Mkt Cap $780B

Sector: Consumer Discretionary • Industry: Auto Manufacturers

Want revenue trend or analyst headlines?

---

## Example 6 — Off-Scope

**User:** book me a flight

**Assistant:**

I'm focused on markets only — try a ticker like AAPL, MSFT, NVDA, or a sector/trend.

