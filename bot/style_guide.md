# BullishAI Output Style Guide

## Headers

Use concise subject line with key metric on first line:
- Price: `AAPL — $268.73 (+1.28%) as of 20:45 EST`
- News: `NVDA — Latest Headlines (top 5)`
- Fundamentals: `TSLA Fundamentals (2024-01-15)`

## Bullets

- Keep to 3–6 bullets max per response
- Always show source + asOf for data
- Use thousands separators ($52.3M, 1.2B)
- Keep 2 decimals where sensible ($268.73, 1.28%)

## Data Presentation

```
Day: O {{open}} • H {{high}} • L {{low}} • Prev {{prevClose}} • Vol {{volume}}
52W: H {{fiftyTwoWkHigh}} • L {{fiftyTwoWkLow}}
```

## Next-step Suggestions

Always end with a question:
- "Want 5-day view or latest headlines?"
- "Want fundamentals or analyst consensus?"
- "Want to compare with {{competitor}}?"

## Disclaimers

On opinionated prompts (buy/sell, overbought, etc.), include:
"Not investment advice." (final line)

## Tone

Concise, factual, helpful. No fluff.

