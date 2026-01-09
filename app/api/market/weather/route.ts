import { NextRequest, NextResponse } from 'next/server'
import { Groq } from 'groq-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const groqKeys = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_SECONDARY,
  process.env.GROQ_API_KEY_THIRD,
  process.env.GROQ_API_KEY_FOURTH,
].filter(Boolean) as string[]
const groqClients = groqKeys.map((key) => new Groq({ apiKey: key }))
let groqIndex = 0

async function callGroqCompletion(params: Groq.Chat.Completions.CompletionCreateParams) {
  if (groqClients.length === 0) throw new Error('Groq API key missing')
  const startIndex = groqIndex % groqClients.length
  groqIndex += 1
  const ordered = groqClients.length === 1
    ? groqClients
    : [groqClients[startIndex], ...groqClients.filter((_, idx) => idx !== startIndex)]

  let lastError: any
  for (const client of ordered) {
    try {
      return await client.chat.completions.create(params)
    } catch (error: any) {
      lastError = error
      const status = error?.status || error?.statusCode
      if (status === 429 || status >= 500) continue
    }
  }
  throw lastError || new Error('Groq completion failed')
}

type CacheEntry = {
  ts: number
  data: any
}

const CACHE_TTL_MS = 180_000
const cache = new Map<string, CacheEntry>()
let groqBackoffUntil = 0

function buildFallback(pulseLabel: string, topSector?: string, volatilityProxy?: number) {
  if (pulseLabel === 'Bullish') {
    return {
      icon: '☀️',
      headline: `Sunny for ${topSector || 'Markets'}`,
      detail: 'Momentum leaders are trending higher with stable volatility.',
      provider: 'template',
    }
  }
  if (pulseLabel === 'Risk-Off') {
    return {
      icon: '🌪️',
      headline: 'High Volatility Incoming',
      detail: 'Risk-off tone with elevated swings across sectors.',
      provider: 'template',
    }
  }
  return {
    icon: '🌧️',
    headline: `Choppy for ${topSector || 'Markets'}`,
    detail: `Range-bound tape with ${volatilityProxy && volatilityProxy > 2 ? 'above average' : 'mixed'} volatility.`,
    provider: 'template',
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market = (searchParams.get('market') || 'US').toUpperCase()
  const cacheKey = `weather-${market}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  const signalsRes = await fetch(`${req.nextUrl.origin}/api/market/signals?market=${market}`, { cache: 'no-store' })
  const signals = await signalsRes.json().catch(() => null)

  const pulse = signals?.pulse || { score: 50, label: 'Neutral', components: { volatilityProxy: 0 } }
  const sectors = (signals?.sectors || []) as Array<{ name: string; changePercent: number }>
  const winners = sectors.filter((s) => s.changePercent > 0).slice(0, 3).map((s) => s.name)
  const losers = sectors.filter((s) => s.changePercent < 0).slice(0, 3).map((s) => s.name)
  const topSector = sectors[0]?.name

  const fallback = buildFallback(pulse.label, topSector, pulse.components?.volatilityProxy)

  if (groqClients.length === 0 || Date.now() < groqBackoffUntil) {
    const payload = { market, weather: fallback, updatedAt: Date.now() }
    cache.set(cacheKey, { ts: Date.now(), data: payload })
    return NextResponse.json(payload)
  }

  try {
    const prompt = `You are BullishAI Market Weather. Return JSON only with fields: icon, headline, detail.

Signals:
- Pulse label: ${pulse.label}
- Pulse score: ${pulse.score}
- Breadth %: ${Number(pulse.components?.breadthPct || 0).toFixed(1)}%
- Volatility proxy: ${Number(pulse.components?.volatilityProxy || 0).toFixed(2)}%
- Momentum avg: ${Number(pulse.components?.momentumAvg || 0).toFixed(2)}%
- Top sectors: ${winners.join(', ') || 'Mixed'}
- Weak sectors: ${losers.join(', ') || 'None'}

Constraints:
- 1-2 sentences max.
- Use one of these icons: ☀️ 🌧️ 🌪️ 🌤️.
- Headline should mention the leading sector if available.
- Avoid certainty, keep probabilistic tone.`

    const completion = await callGroqCompletion({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return JSON only, no extra text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 120,
    })

    const raw = completion.choices?.[0]?.message?.content || ''
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    const parsed = jsonStart !== -1 && jsonEnd !== -1 ? JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) : null

    if (parsed?.icon && parsed?.headline && parsed?.detail) {
      const payload = {
        market,
        weather: { ...parsed, provider: 'groq' },
        updatedAt: Date.now(),
      }
      cache.set(cacheKey, { ts: Date.now(), data: payload })
      return NextResponse.json(payload)
    }
  } catch (error: any) {
    groqBackoffUntil = Date.now() + 5 * 60 * 1000
    console.warn('[weather] Groq failed, using template fallback:', error?.message || error)
  }

  const payload = { market, weather: fallback, updatedAt: Date.now() }
  cache.set(cacheKey, { ts: Date.now(), data: payload })
  return NextResponse.json(payload)
}
