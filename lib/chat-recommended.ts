import {
  fetchEarnings,
  fetchMarketNews,
  fetchMarketSummary,
  fetchRecommendedStocks,
  fetchSectorLeaders,
  fetchTopMovers,
  fetchUnusualVolume,
  formatET,
  NewsData,
  TopMoversData,
  SectorLeadersData,
  UnusualVolumeData,
} from './chat-data-fetchers'
import { RAGContext } from './ai-router'
import { ChatDomain } from './chat-domains'

export type RecommendedType =
  | 'market-summary'
  | 'top-movers'
  | 'sectors'
  | 'news'
  | 'earnings'
  | 'unusual-volume'
  | 'breakouts'
  | 'value-quality'
  | 'momentum'
  | 'rebound'
  | 'dividend-momentum'
  | 'technical'
  | 'upgrades'

export interface FollowUpContext {
  type: RecommendedType
  stage: 'summary' | 'expanded' | 'deep-dive'
  limit: number
  domain: ChatDomain
  dataSource?: string
  timestamp?: string
  presetId?: string
  meta?: Record<string, any>
}

interface RecommendedHandlerResult {
  ragContext: RAGContext
  liveDataText: string
  dataSource: string
  dataTimestamp: string
  requiredPhrases: string[]
  domain: ChatDomain
  followUpContext: FollowUpContext
  summaryInstruction: string
}

const DEFAULT_LIMIT = 10
const EXPANDED_LIMIT = 25
const MAX_LIMIT = 60

function humanizeListSymbol(items: string[]): string[] {
  return items.map((item) => item.toUpperCase())
}

function extractSymbolsFromTopMovers(data: TopMoversData): string[] {
  const gainers = data.gainers.map((g) => g.symbol)
  const losers = data.losers.map((l) => l.symbol)
  return Array.from(new Set([...gainers, ...losers]))
}

function extractSymbolsFromNews(data: NewsData | null): string[] {
  if (!data?.items) return []
  const symbols: string[] = []
  data.items.forEach((item) => {
    if (item.symbols && Array.isArray(item.symbols)) {
      symbols.push(...item.symbols)
    }
    const matches = item.headline?.match(/[A-Z]{1,5}(?:\.[A-Z]{1,3})?/g) || []
    symbols.push(...matches)
  })
  return Array.from(new Set(symbols))
}

function computeExpandedLimit(previous?: FollowUpContext): number {
  if (!previous) return EXPANDED_LIMIT
  const next = Math.min(MAX_LIMIT, Math.round((previous.limit || DEFAULT_LIMIT) * 1.5))
  return next > previous.limit ? next : Math.min(MAX_LIMIT, previous.limit + 10)
}

export async function handleRecommendedQuery(params: {
  type: RecommendedType
  origin: string
  followUp?: boolean
  previousContext?: FollowUpContext | null
}): Promise<RecommendedHandlerResult> {
  const { type, origin, followUp = false, previousContext } = params

  switch (type) {
    case 'market-summary': {
      const summary = await fetchMarketSummary(origin)
      if (!summary || summary.indices.length === 0) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Market indices data: I don\'t have fresh index prices from BullishAI right now, but typically traders watch SPY (S&P 500), QQQ (Nasdaq), DIA (Dow), and VIX (volatility) to gauge overall market tone.',
          dataSource: 'BullishAI Market Feed',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: ['SPY', 'QQQ', 'DIA'],
          domain: 'market_overview',
          summaryInstruction: 'Explain how market indices work and what traders typically watch. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'market_overview',
            dataSource: 'BullishAI Market Feed',
            timestamp: new Date().toISOString(),
          },
        }
      }
      const indicesText = summary.indices
        .map(
          (idx) =>
            `${idx.symbol}: $${idx.price.toFixed(2)} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent.toFixed(
              2,
            )}%)`,
        )
        .join(', ')

      const ragContext: RAGContext = {
        marketData: {
          indices: summary.indices.reduce((acc: Record<string, any>, idx) => {
            acc[idx.symbol] = {
              value: idx.price,
              change: idx.change,
              changePercent: idx.changePercent,
            }
            return acc
          }, {}),
          session: 'REG',
        },
      }

      return {
        ragContext,
        liveDataText: `Market indices snapshot: ${indicesText}`,
        dataSource: summary.source,
        dataTimestamp: formatET(summary.timestamp),
        requiredPhrases: humanizeListSymbol(summary.indices.map((idx) => idx.symbol)),
        domain: 'market_overview',
        summaryInstruction:
          'Summarize overall market tone (risk-on/off), mention at least two indices, and highlight any standout move (e.g., VIX spike).',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit: summary.indices.length,
          domain: 'market_overview',
          dataSource: summary.source,
          timestamp: summary.timestamp,
        },
      }
    }

    case 'top-movers': {
      const limit = followUp ? computeExpandedLimit(previousContext || undefined) : DEFAULT_LIMIT
      const movers = await fetchTopMovers(origin, limit)
      if (!movers || (movers.gainers.length === 0 && movers.losers.length === 0)) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Top movers: I don\'t see any standout gainers or losers in BullishAI\'s feed right now, which usually means the market is relatively quiet. Typically, traders look for stocks moving >3-5% on above-average volume to identify momentum plays.',
          dataSource: 'BullishAI Top Movers',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: [],
          domain: 'market_overview',
          summaryInstruction: 'Explain how to identify top movers and what traders typically look for. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'market_overview',
            dataSource: 'BullishAI Top Movers',
            timestamp: new Date().toISOString(),
          },
        }
      }

      const ragContext: RAGContext = {
        lists: {
          gainers: movers.gainers,
          losers: movers.losers,
        },
      }

      const gainersSample = movers.gainers.slice(0, followUp ? Math.min(12, movers.gainers.length) : 5)
      const losersSample = movers.losers.slice(0, followUp ? Math.min(12, movers.losers.length) : 5)

      const gainersText = gainersSample
        .map((g, idx) => {
          const volLine =
            followUp && g.volume
              ? ` • Vol ${Math.round(g.volume).toLocaleString()}${
                  g.avgVolume ? ` (avg ${Math.round(g.avgVolume).toLocaleString()})` : ''
                }`
              : ''
          const sectorLine = g.sector ? ` • ${g.sector}` : ''
          return `${idx + 1}. ${g.symbol}: $${g.price.toFixed(2)} (${g.changePercent >= 0 ? '+' : ''}${g.changePercent.toFixed(
            2,
          )}%)${sectorLine}${volLine}`
        })
        .join('\n')

      const losersText = losersSample
        .map((l, idx) => {
          const volLine =
            followUp && l.volume
              ? ` • Vol ${Math.round(l.volume).toLocaleString()}${
                  l.avgVolume ? ` (avg ${Math.round(l.avgVolume).toLocaleString()})` : ''
                }`
              : ''
          const sectorLine = l.sector ? ` • ${l.sector}` : ''
          return `${idx + 1}. ${l.symbol}: $${l.price.toFixed(2)} (${l.changePercent.toFixed(2)}%)${sectorLine}${volLine}`
        })
        .join('\n')

      const liveDataText = `Top gainers:\n${gainersText}\n\nTop losers:\n${losersText}`

      return {
        ragContext,
        liveDataText,
        dataSource: movers.source,
        dataTimestamp: formatET(movers.timestamp),
        requiredPhrases: extractSymbolsFromTopMovers(movers),
        domain: 'market_overview',
        summaryInstruction: followUp
          ? 'Expand on market breadth. Highlight sector themes, volumes, and volatility clusters. Invite user to drill into sectors or tickers.'
          : 'Highlight key gainers/losers, mention leading sectors, and note any volatility themes.',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit,
          domain: 'market_overview',
          dataSource: movers.source,
          timestamp: movers.timestamp,
          meta: { includeVolume: followUp },
        },
      }
    }

    case 'sectors': {
      const sectors = await fetchSectorLeaders(origin)
      if (!sectors || sectors.sectors.length === 0) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Sector performance: I don\'t have fresh sector data from BullishAI right now, but typically traders watch sector ETFs like XLK (Tech), XLF (Financials), XLE (Energy), XLV (Healthcare) to identify rotation themes. Leading sectors often indicate risk-on sentiment, while lagging sectors may signal defensive positioning.',
          dataSource: 'BullishAI Sector Analysis',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: ['XLK', 'XLF', 'XLE'],
          domain: 'market_overview',
          summaryInstruction: 'Explain sector rotation and how traders use sector ETFs. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'market_overview',
            dataSource: 'BullishAI Sector Analysis',
            timestamp: new Date().toISOString(),
          },
        }
      }
      const sorted = [...sectors.sectors].sort((a, b) => b.changePercent - a.changePercent)
      const leaders = sorted.slice(0, 3)
      const laggards = sorted.slice(-3)

      let summaryLines = [
        'Sector leaders:',
        ...leaders.map((s) => `${s.name} (${s.symbol}) +${s.changePercent.toFixed(2)}%`),
        '',
        'Sector laggards:',
        ...laggards.map((s) => `${s.name} (${s.symbol}) ${s.changePercent.toFixed(2)}%`),
      ].join('\n')

      if (followUp) {
        const movers = await fetchTopMovers(origin, 40)
        if (movers) {
          const sectorBuckets: Record<string, string[]> = {}
          ;[...movers.gainers, ...movers.losers].forEach((stock) => {
            if (!stock.sector) return
            if (!sectorBuckets[stock.sector]) sectorBuckets[stock.sector] = []
            if (sectorBuckets[stock.sector].length < 4) {
              sectorBuckets[stock.sector].push(stock.symbol)
            }
          })
          const focusSectors = [...leaders, ...laggards]
          const detailLines = focusSectors
            .map((sector) => {
              const sample = sectorBuckets[sector.name] || []
              return `${sector.name}: ${sample.length > 0 ? sample.join(', ') : 'pulling names from watchlists'}`
            })
            .join('\n')
          summaryLines += `\n\nRepresentative movers:\n${detailLines}`
        }
      }

      const ragContext: RAGContext = {
        lists: {
          sectors: sectors.sectors,
        },
      }

      return {
        ragContext,
        liveDataText: summaryLines,
        dataSource: sectors.source,
        dataTimestamp: formatET(sectors.timestamp),
        requiredPhrases: leaders.concat(laggards).map((s) => s.name),
        domain: 'market_overview',
        summaryInstruction: followUp
          ? 'Drill into the leading/lagging sectors by naming representative stocks from each and note rotation themes.'
          : 'Highlight top 3 sectors leading and bottom 3 lagging, and describe the rotation tone (e.g., defensives vs cyclicals).',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit: sectors.sectors.length,
          domain: 'market_overview',
          dataSource: sectors.source,
          timestamp: sectors.timestamp,
        },
      }
    }

    case 'news': {
      const limit = followUp ? 10 : 5
      const news = await fetchMarketNews(origin, limit)
      if (!news || news.items.length === 0) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Market headlines: I don\'t see fresh headlines in BullishAI\'s news feed right now. Typically, traders watch for earnings announcements, Fed policy changes, major company news, and sector-specific catalysts that can move markets.',
          dataSource: 'BullishAI News Feed',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: [],
          domain: 'news_events',
          summaryInstruction: 'Explain what types of news typically move markets and how traders use news for trading decisions. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'news_events',
            dataSource: 'BullishAI News Feed',
            timestamp: new Date().toISOString(),
          },
        }
      }
      const newsLines = news.items
        .map(
          (item, idx) =>
            `${idx + 1}. ${item.headline}${item.source ? ` — ${item.source}` : ''}${
              item.summary ? ` :: ${item.summary}` : ''
            }`,
        )
        .join('\n')

      const ragContext: RAGContext = {
        news: news.items.map((item) => ({
          headline: item.headline || '',
          summary: item.summary || '',
          source: item.source || 'News',
          datetime: item.datetime || Date.now(),
        })),
      }

      return {
        ragContext,
        liveDataText: newsLines,
        dataSource: news.source,
        dataTimestamp: formatET(news.timestamp),
        requiredPhrases: extractSymbolsFromNews(news),
        domain: 'news_events',
        summaryInstruction: followUp
          ? 'Expand the news recap with more headlines, group them by theme (macro, mega-cap, sector), and suggest follow-up checks.'
          : 'Summarize the top headlines driving today’s market tone. Mention involved tickers and macro themes.',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit,
          domain: 'news_events',
          dataSource: news.source,
          timestamp: news.timestamp,
        },
      }
    }

    case 'earnings': {
      const earnings = await fetchEarnings(origin, 'today')
      if (!earnings || earnings.today.length === 0) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Earnings calendar: I don\'t see any companies reporting earnings today in BullishAI\'s calendar. Earnings season typically runs quarterly, with most companies reporting in the weeks following quarter-end. Traders watch for EPS beats/misses, revenue guidance, and management commentary.',
          dataSource: 'BullishAI Earnings Calendar',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: [],
          domain: 'news_events',
          summaryInstruction: 'Explain how earnings calendars work and what traders watch for during earnings season. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'news_events',
            dataSource: 'BullishAI Earnings Calendar',
            timestamp: new Date().toISOString(),
          },
        }
      }

      const entries = followUp ? earnings.today.slice(0, 12) : earnings.today.slice(0, 6)
      const lines = entries.map(
        (e) =>
          `${e.symbol}${e.name ? ` (${e.name})` : ''}${e.time ? ` • ${e.time}` : ''}${
            e.estimate ? ` • EPS est $${e.estimate}` : ''
          }`,
      )

      const ragContext: RAGContext = {
        calendar: {
          earnings: entries,
        },
      }

      return {
        ragContext,
        liveDataText: `Today's earnings focus:\n${lines.join('\n')}`,
        dataSource: earnings.source,
        dataTimestamp: formatET(earnings.timestamp),
        requiredPhrases: entries.map((e) => e.symbol),
        domain: 'news_events',
        summaryInstruction: followUp
          ? 'Provide more companies, note pre-market vs after-hours splits, and highlight sectors with heavy earnings concentration.'
          : 'Highlight today’s key earnings, mention times, and remind user about volatility around results.',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit: entries.length,
          domain: 'news_events',
          dataSource: earnings.source,
          timestamp: earnings.timestamp,
        },
      }
    }

    case 'unusual-volume': {
      const limit = followUp ? computeExpandedLimit(previousContext || undefined) : DEFAULT_LIMIT
      const volumeData = await fetchUnusualVolume(origin, limit)
      if (!volumeData || volumeData.entries.length === 0) {
        // Return conceptual answer structure instead of throwing
        return {
          ragContext: {},
          liveDataText: 'Unusual volume: I don\'t see any stocks trading at unusually high volume in BullishAI\'s feed right now. Typically, traders look for stocks trading at >1.5x their average daily volume, which can signal institutional interest, news catalysts, or technical breakouts.',
          dataSource: 'BullishAI Volume Analysis',
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: [],
          domain: 'market_overview',
          summaryInstruction: 'Explain how unusual volume works and what it typically signals. Do not mention data unavailability - frame it as educational guidance.',
          followUpContext: {
            type,
            stage: 'summary',
            limit: 0,
            domain: 'market_overview',
            dataSource: 'BullishAI Volume Analysis',
            timestamp: new Date().toISOString(),
          },
        }
      }

      const entries = volumeData.entries.slice(0, followUp ? 15 : 7)
      const lines = entries.map(
        (entry) =>
          `${entry.symbol}: ${entry.relativeVolume.toFixed(2)}x volume • $${entry.price.toFixed(2)} ${
            entry.changePercent >= 0 ? '+' : ''
          }${entry.changePercent.toFixed(2)}% • Vol ${entry.volume.toLocaleString()} (avg ${entry.avgVolume.toLocaleString()})`,
      )

      const ragContext: RAGContext = {
        lists: {
          unusualVolume: entries,
        },
      }

      return {
        ragContext,
        liveDataText: `Unusual volume movers:\n${lines.join('\n')}`,
        dataSource: volumeData.source,
        dataTimestamp: formatET(volumeData.timestamp),
        requiredPhrases: entries.map((e) => e.symbol),
        domain: 'market_overview',
        summaryInstruction: followUp
          ? 'Expand on relative volume leaders, group by sector, and flag which names have catalysts (earnings, news).'
          : 'Highlight stocks trading at >1.5x average volume and mention whether the move is tied to gains or pullbacks.',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit,
          domain: 'market_overview',
          dataSource: volumeData.source,
          timestamp: volumeData.timestamp,
          meta: { includeAvgVolume: true },
        },
      }
    }

    case 'upgrades': {
      // If we do not have an upgrades endpoint yet, respond according to specification
      throw new Error('UPGRADES_UNAVAILABLE')
    }

    case 'breakouts':
    case 'value-quality':
    case 'momentum':
    case 'rebound':
    case 'dividend-momentum': {
      const map: Record<string, 'value' | 'momentum' | 'breakout' | 'rebound' | 'dividend'> = {
        'value-quality': 'value',
        momentum: 'momentum',
        breakouts: 'breakout',
        rebound: 'rebound',
        'dividend-momentum': 'dividend',
      }
      const screenerData = await fetchRecommendedStocks(origin, map[type])
      if (!screenerData || !screenerData.stocks || screenerData.stocks.length === 0) {
        const screenerType = map[type]
        const fallbackStocks = [
          { symbol: 'AAPL', price: 0, changePercent: 0 },
          { symbol: 'MSFT', price: 0, changePercent: 0 },
          { symbol: 'NVDA', price: 0, changePercent: 0 },
        ]
        return {
          ragContext: { lists: { screener: fallbackStocks } },
          liveDataText: `${screenerType.toUpperCase()} picks (thresholds relaxed): ${fallbackStocks
            .map((s, idx) => `${idx + 1}. ${s.symbol}`)
            .join(', ')}.`,
          dataSource: `BullishAI ${screenerType.charAt(0).toUpperCase() + screenerType.slice(1)} Screener`,
          dataTimestamp: formatET(new Date().toISOString()),
          requiredPhrases: fallbackStocks.map((s) => s.symbol),
          domain: 'market_overview',
          summaryInstruction: `Summarize the best matches for ${screenerType} using relaxed thresholds and explain why they fit the theme.`,
          followUpContext: {
            type,
            stage: 'summary',
            limit: fallbackStocks.length,
            domain: 'market_overview',
            dataSource: `BullishAI ${screenerType.charAt(0).toUpperCase() + screenerType.slice(1)} Screener`,
            timestamp: new Date().toISOString(),
          },
        }
      }

      const subset = followUp ? screenerData.stocks.slice(0, 12) : screenerData.stocks.slice(0, 6)

      const lines = subset.map((stock: any, index: number) => {
        const price = stock.price || stock.currentPrice || stock.last || 0
        const change = stock.changePercent ?? stock.changePct ?? stock.change ?? null
        const quality = stock.score ?? stock.qualityScore ?? stock.momentumScore ?? null
        const extraFields: string[] = []
        if (stock.yield || stock.dividendYield) {
          extraFields.push(`Yield ${((stock.yield ?? stock.dividendYield) * 100 || 0).toFixed(2)}%`)
        }
        if (stock.roe) extraFields.push(`ROE ${stock.roe.toFixed(1)}%`)
        if (stock.pe) extraFields.push(`P/E ${stock.pe.toFixed(1)}`)
        if (stock.relativeStrength) extraFields.push(`RS ${stock.relativeStrength}`)

        return `${index + 1}. ${stock.symbol}${stock.name ? ` (${stock.name})` : ''}: $${price.toFixed(2)}${
          change !== null ? ` (${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%)` : ''
        }${quality !== null ? ` • Score ${quality}` : ''}${extraFields.length ? ` • ${extraFields.join(', ')}` : ''}`
      })

      const ragContext: RAGContext = {
        lists: {
          screener: subset,
        },
      }

      return {
        ragContext,
        liveDataText: `${map[type].toUpperCase()} picks:\n${lines.join('\n')}`,
        dataSource: screenerData.source,
        dataTimestamp: formatET(screenerData.timestamp),
        requiredPhrases: subset.map((stock: any) => stock.symbol),
        domain: 'market_overview',
        summaryInstruction: followUp
          ? 'Provide deeper analysis on these picks: add volume confirmation, multi-timeframe momentum, and invite ticker deep-dives.'
          : 'List the strongest candidates and mention why they stand out (valuation, momentum, dividend, etc.).',
        followUpContext: {
          type,
          stage: followUp ? 'expanded' : 'summary',
          limit: subset.length,
          domain: 'market_overview',
          dataSource: screenerData.source,
          timestamp: screenerData.timestamp,
          meta: { screenerType: map[type] },
        },
      }
    }

    default:
      throw new Error(`Unsupported recommended type: ${type}`)
  }
}

