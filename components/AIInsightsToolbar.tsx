'use client'

import { useState, useEffect } from 'react'
import { Zap, Star, BarChart3, ChevronRight, X } from 'lucide-react'
import { Reveal } from './anim/Reveal'
import useSWR from 'swr'

interface CardConfig {
  id: string
  label: string
  description: string
  params: Record<string, any>
  data_fetch: string[]
  refresh_ms: number
  cache_ttl_ms: number
  compute: string
  render: {
    component: string
    props?: Record<string, any>
  }
  output_schema: any
  model_routing?: {
    prefer: string
    prompt_template?: string
  }
}

interface SectionConfig {
  id: string
  title: string
  cards: CardConfig[]
}

interface PresetConfig {
  sections: SectionConfig[]
}

interface AIInsightsToolbarProps {
  symbol?: string
  onCardSelect?: (card: CardConfig, data: any) => void
}

export function AIInsightsToolbar({ symbol, onCardSelect }: AIInsightsToolbarProps) {
  const [config, setConfig] = useState<PresetConfig | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardConfig | null>(null)
  const [cardData, setCardData] = useState<any>(null)

  // Load config
  useEffect(() => {
    fetch('/configs/ai_insights_presets.json')
      .then(r => r.json())
      .then(setConfig)
      .catch(err => console.error('Failed to load AI insights config:', err))
  }, [])

  // Fetch data for selected card
  const cardKey = selectedCard ? `ai-card-${selectedCard.id}-${symbol || 'market'}` : null
  const { data, error, isLoading } = useSWR(
    selectedCard ? [cardKey, selectedCard, symbol] : null,
    async ([, card, sym]) => {
      if (!card) return null

      // Interpolate params
      const interpolateUrl = (url: string) => {
        return url.replace(/\{\{symbol\}\}/g, sym || 'SPY')
          .replace(/\{\{symbols\}\}/g, 'AAPL,MSFT,GOOGL')
      }

      // Fetch all data sources in parallel
      const fetchPromises = card.data_fetch.map(url => {
        let finalUrl = interpolateUrl(url)
        // Support both 'tickers' and 'symbols' parameter
        finalUrl = finalUrl.replace(/tickers=/g, 'symbols=')
        
        return fetch(finalUrl.startsWith('/') ? finalUrl : `${window.location.origin}${finalUrl}`)
          .then(r => r.json())
          .then(data => {
            // Normalize quotes format if needed
            if (data.quotes && Array.isArray(data.quotes)) {
              return {
                ...data,
                quotes: data.quotes.map((q: any) => {
                  if (q.data) {
                    // Normalize from { symbol, data: {...} } to { symbol, price, change, ... }
                    return {
                      symbol: q.symbol,
                      name: q.name || q.symbol,
                      price: q.data.price || 0,
                      change: q.data.change || 0,
                      changePercent: q.data.dp || 0,
                      volume: q.data.volume || 0,
                      avgVolume: q.data.avgVolume || q.data.volume || 0,
                      high52w: q.data.week52High || q.data.high || 0,
                      low52w: q.data.week52Low || q.data.low || 0,
                      pe: q.data.peRatio || null,
                    }
                  }
                  return q
                }),
              }
            }
            return data
          })
          .catch(err => {
            console.error(`Failed to fetch ${finalUrl}:`, err)
            return null
          })
      })

      const rawData = await Promise.all(fetchPromises)
      
      // Run compute step
      const computed = await runCompute(card.compute, rawData, card)
      
      // If model routing is needed, call AI
      if (card.model_routing && card.model_routing.prompt_template) {
        const aiResponse = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: interpolateTemplate(card.model_routing.prompt_template, computed),
            model: card.model_routing.prefer,
          }),
        }).then(r => r.json()).catch(() => ({ answer: '' }))
        
        return { ...computed, ai_summary: aiResponse.answer }
      }
      
      return computed
    },
    {
      refreshInterval: selectedCard ? selectedCard.refresh_ms : 0,
      revalidateOnFocus: true,
      dedupingInterval: selectedCard ? selectedCard.cache_ttl_ms : 0,
    }
  )

  useEffect(() => {
    if (data && selectedCard) {
      setCardData(data)
      onCardSelect?.(selectedCard, data)
    }
  }, [data, selectedCard, onCardSelect])

  const runCompute = async (computeType: string, rawData: any[], card: CardConfig): Promise<any> => {
    // Simple compute functions - in production, these would be more sophisticated
    switch (computeType) {
      case 'merge_quotes_and_breadth':
        const quotes = rawData[0]?.quotes || []
        const indices = quotes.filter((q: any) => ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'DXY'].includes(q.symbol))
        return {
          indices,
          breadth: rawData[1] || {},
          news: rawData[2]?.items || [],
          bullets: [
            `Market breadth: ${rawData[1]?.advancing || 0} advancing, ${rawData[1]?.declining || 0} declining`,
            `Volume ratio: ${rawData[1]?.adv_dec_ratio?.toFixed(2) || 'N/A'}`,
            `Top news: ${rawData[2]?.items?.[0]?.headline || 'No major news'}`,
          ],
          tickers: indices.slice(0, 3).map((q: any) => ({
            symbol: q.symbol,
            change: q.changePercent || 0,
            reason: 'Market index',
          })),
        }
      case 'format_breadth_data':
        const breadth = rawData[0] || {}
        return {
          ...breadth,
          advancing: breadth.advancing || 0,
          declining: breadth.declining || 0,
          volume_up: breadth.volume_up || 0,
          volume_down: breadth.volume_down || 0,
          new_highs: breadth.new_highs || 0,
          new_lows: breadth.new_lows || 0,
          adv_dec_ratio: breadth.adv_dec_ratio || 0,
        }
      case 'merge_news_and_movers':
        const newsItems = rawData[0]?.items || []
        const movers = rawData[1]?.movers || []
        // Merge by symbol
        const merged = newsItems.map((item: any) => {
          const mover = movers.find((m: any) => m.symbol === item.symbol)
          return {
            ...item,
            ...(mover || {}),
          }
        })
        // Add movers without news
        movers.forEach((mover: any) => {
          if (!merged.find((item: any) => item.symbol === mover.symbol)) {
            merged.push(mover)
          }
        })
        return { items: merged }
      case 'format_volume_data':
        return { stocks: rawData[0]?.stocks || [] }
      case 'format_earnings_data':
        return { earnings: rawData[0]?.earnings || [] }
      case 'format_sector_data':
        return { sectors: rawData[0]?.sectors || [] }
      case 'format_upgrades':
        return { upgrades: rawData[0]?.upgrades || [] }
      case 'filter_breakouts':
        return { breakouts: rawData[0]?.breakouts || [] }
      case 'format_value_quality':
        return { stocks: rawData[0]?.stocks || [] }
      case 'format_momentum':
        return { stocks: rawData[0]?.stocks || [] }
      case 'format_rebound':
        return { stocks: rawData[0]?.stocks || [] }
      case 'format_dividend_momentum':
        return { stocks: rawData[0]?.stocks || [] }
      case 'calculate_sma_and_pivots':
        return calculateSMAs(rawData[0], rawData[1])
      case 'detect_patterns':
        return { symbol: symbol || 'SPY', patterns: [] }
      case 'calculate_momentum_indicators':
        return calculateMomentum(rawData[0], rawData[1])
      case 'calculate_rr':
        return calculateRR(rawData[0], rawData[1])
      case 'analyze_timeframes':
        return analyzeTimeframes(rawData)
      case 'generate_risk_note':
        return generateRiskNote(rawData[0], rawData[1])
      default:
        return rawData[0] || {}
    }
  }

  const interpolateTemplate = (template: string, data: any): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return JSON.stringify(data[key] || '')
    })
  }

  const calculateSMAs = (ohlc: any, quote: any) => {
    if (!ohlc?.candles) return {}
    const closes = ohlc.candles.map((c: any) => parseFloat(c.close)).slice(-200)
    return {
      symbol: symbol || 'SPY',
      price: parseFloat(quote?.price || 0),
      sma_20: closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20,
      sma_50: closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50,
      sma_200: closes.reduce((a: number, b: number) => a + b, 0) / closes.length,
      support_levels: [closes.slice(-20).reduce((a: number, b: number) => Math.min(a, b), Infinity)],
      resistance_levels: [closes.slice(-20).reduce((a: number, b: number) => Math.max(a, b), -Infinity)],
      trend: 'neutral',
    }
  }

  const calculateMomentum = (volatility: any, ohlc: any) => {
    if (!ohlc?.candles) return {}
    const closes = ohlc.candles.map((c: any) => parseFloat(c.close))
    const rsi = calculateRSI(closes)
    return {
      symbol: symbol || 'SPY',
      rsi,
      macd: 0,
      macd_signal: 0,
      stochastic: 0,
      '52w_high': Math.max(...closes),
      '52w_low': Math.min(...closes),
      distance_from_high: ((closes[closes.length - 1] - Math.max(...closes)) / Math.max(...closes)) * 100,
    }
  }

  const calculateRSI = (prices: number[], period = 14): number => {
    if (prices.length < period + 1) return 50
    const changes = prices.slice(1).map((p, i) => p - prices[i])
    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period
    const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period
    if (losses === 0) return 100
    const rs = gains / losses
    return 100 - (100 / (1 + rs))
  }

  const calculateRR = (ohlc: any, quote: any) => {
    if (!ohlc?.candles) return {}
    const price = parseFloat(quote?.price || 0)
    const highs = ohlc.candles.map((c: any) => parseFloat(c.high))
    const lows = ohlc.candles.map((c: any) => parseFloat(c.low))
    const resistance = Math.max(...highs.slice(-20))
    const support = Math.min(...lows.slice(-20))
    return {
      symbol: symbol || 'SPY',
      entry: price,
      stop: support * 0.98,
      target: resistance * 1.02,
      risk_reward_ratio: (resistance * 1.02 - price) / (price - support * 0.98),
      risk_percent: ((price - support * 0.98) / price) * 100,
    }
  }

  const analyzeTimeframes = (timeframes: any[]) => {
    return {
      symbol: symbol || 'SPY',
      timeframes: {
        '1h': { trend: 'neutral', strength: 50 },
        '1d': { trend: 'neutral', strength: 50 },
        '1w': { trend: 'neutral', strength: 50 },
      },
      alignment: 'mixed',
    }
  }

  const generateRiskNote = (volatility: any, quote: any) => {
    return {
      symbol: symbol || 'SPY',
      risk_level: 'moderate',
      key_risks: ['Market volatility', 'Sector-specific risks', 'Economic factors'],
      disclaimer: 'Not financial advice. Past performance does not guarantee future results.',
    }
  }

  const sectionIcons: Record<string, any> = {
    'quick-insights': Zap,
    'recommended': Star,
    'technical': BarChart3,
  }

  if (!config) {
    return (
      <div className="w-64 bg-slate-800 border-r border-slate-700 p-4">
        <div className="text-slate-400 text-sm">Loading AI insights...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left Toolbar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">AI Insights</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {config.sections.map((section) => {
            const Icon = sectionIcons[section.id] || Zap
            const isExpanded = expandedSection === section.id
            
            return (
              <div key={section.id} className="border-b border-slate-700">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-blue-400" />
                    <span className="text-white font-medium">{section.title}</span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                
                {isExpanded && (
                  <div className="bg-slate-900/50">
                    {section.cards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => {
                          setSelectedCard(card)
                          setExpandedSection(null)
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700/30 transition border-l-2 border-transparent hover:border-blue-500"
                      >
                        <div className="text-sm font-medium text-white">{card.label}</div>
                        <div className="text-xs text-slate-400 mt-1">{card.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Card Display Area */}
      {selectedCard && (
        <div className="flex-1 bg-slate-900 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-white">{selectedCard.label}</h3>
              <p className="text-sm text-slate-400">{selectedCard.description}</p>
            </div>
            <button
              onClick={() => {
                setSelectedCard(null)
                setCardData(null)
              }}
              className="p-2 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-red-400">Error loading data: {error.message}</p>
            </div>
          )}

          {cardData && (
            <CardRenderer card={selectedCard} data={cardData} />
          )}
        </div>
      )}
    </div>
  )
}

function CardRenderer({ card, data }: { card: CardConfig; data: any }) {
  const Component = getCardComponent(card.render.component)
  return <Component data={data} {...card.render.props} />
}

function getCardComponent(componentName: string) {
  const components: Record<string, React.ComponentType<any>> = {
    InsightCard,
    HeatmapGrid,
    RankedList,
    Table,
    SparkTable,
    BadgeGrid,
    TAOverview,
    PatternList,
    GaugesRow,
    RRCard,
    AlignmentMeters,
    InlineNote,
  }
  return components[componentName] || InsightCard
}

// Card Components
function InsightCard({ data, showSparkline, showBullets }: any) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      {data.ai_summary && (
        <p className="text-slate-300 leading-relaxed mb-4">{data.ai_summary}</p>
      )}
      {showBullets && data.bullets && (
        <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
          {data.bullets.map((b: string, i: number) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {data.tickers && (
        <div className="grid grid-cols-3 gap-4 mt-4">
          {data.tickers.map((t: any, i: number) => (
            <div key={i} className="bg-slate-700/50 rounded-lg p-3">
              <div className="font-semibold text-white">{t.symbol}</div>
              <div className={`text-sm ${t.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {t.change >= 0 ? '+' : ''}{t.change}%
              </div>
              <div className="text-xs text-slate-400 mt-1">{t.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HeatmapGrid({ data, type }: any) {
  const items = type === 'sector' ? data.sectors : [
    { label: 'Advancing', value: data.advancing, color: 'green' },
    { label: 'Declining', value: data.declining, color: 'red' },
    { label: 'Volume Up', value: data.volume_up, color: 'green' },
    { label: 'Volume Down', value: data.volume_down, color: 'red' },
  ]
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-2">{item.label || item.name}</div>
          <div className={`text-2xl font-bold ${item.color === 'green' ? 'text-green-400' : item.color === 'red' ? 'text-red-400' : 'text-white'}`}>
            {item.value?.toLocaleString() || item.changePercent?.toFixed(2) + '%'}
          </div>
        </div>
      ))}
    </div>
  )
}

function RankedList({ data, showRating, showTarget, showMomentum, showVolume }: any) {
  const items = data.items || data.upgrades || data.stocks || []
  
  return (
    <div className="space-y-3">
      {items.slice(0, 10).map((item: any, i: number) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {i + 1}
            </div>
            <div>
              <div className="font-semibold text-white">{item.symbol || item.name}</div>
              {item.name && <div className="text-sm text-slate-400">{item.name}</div>}
            </div>
          </div>
          <div className="text-right">
            {item.changePercent !== undefined && (
              <div className={`font-semibold ${item.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </div>
            )}
            {showRating && item.rating && (
              <div className="text-sm text-slate-400">{item.rating}</div>
            )}
            {showTarget && item.target_price && (
              <div className="text-sm text-slate-400">Target: ${item.target_price.toFixed(2)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Table({ data, columns }: any) {
  const items = data.stocks || data.earnings || []
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            {columns.map((col: string) => (
              <th key={col} className="text-left p-3 text-slate-400 font-semibold">
                {col.replace(/_/g, ' ').toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 10).map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-800">
              {columns.map((col: string) => (
                <td key={col} className="p-3 text-slate-300">
                  {typeof item[col] === 'number' ? item[col].toFixed(2) : item[col] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SparkTable({ data, showImpliedMove, showRSI, showTrend }: any) {
  const items = data.earnings || data.stocks || []
  
  return (
    <div className="space-y-3">
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">{item.symbol}</div>
              {item.name && <div className="text-sm text-slate-400">{item.name}</div>}
            </div>
            <div className="text-right">
              {item.implied_move && showImpliedMove && (
                <div className="text-sm text-blue-400">±{item.implied_move.toFixed(2)}%</div>
              )}
              {item.rsi && showRSI && (
                <div className="text-sm text-slate-400">RSI: {item.rsi.toFixed(1)}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BadgeGrid({ data, showVolume, show52WHigh }: any) {
  const items = data.breakouts || []
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="font-semibold text-white">{item.symbol}</div>
          <div className="text-sm text-slate-400 mt-1">${item.price?.toFixed(2)}</div>
          {showVolume && item.volume_ratio && (
            <div className="text-xs text-blue-400 mt-2">Vol: {item.volume_ratio.toFixed(1)}x</div>
          )}
        </div>
      ))}
    </div>
  )
}

function TAOverview({ data, showSMAs, showPivots }: any) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="grid grid-cols-3 gap-4 mb-4">
        {showSMAs && (
          <>
            <div>
              <div className="text-sm text-slate-400">SMA 20</div>
              <div className="text-lg font-semibold text-white">${data.sma_20?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">SMA 50</div>
              <div className="text-lg font-semibold text-white">${data.sma_50?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">SMA 200</div>
              <div className="text-lg font-semibold text-white">${data.sma_200?.toFixed(2)}</div>
            </div>
          </>
        )}
      </div>
      {showPivots && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm text-slate-400">Support</div>
            <div className="text-lg font-semibold text-green-400">
              ${data.support_levels?.[0]?.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Resistance</div>
            <div className="text-lg font-semibold text-red-400">
              ${data.resistance_levels?.[0]?.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PatternList({ data }: any) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <p className="text-slate-400">Pattern detection coming soon</p>
    </div>
  )
}

function GaugesRow({ data }: any) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
        <div className="text-sm text-slate-400 mb-2">RSI</div>
        <div className="text-2xl font-bold text-white">{data.rsi?.toFixed(1)}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
        <div className="text-sm text-slate-400 mb-2">52W High</div>
        <div className="text-2xl font-bold text-white">${data['52w_high']?.toFixed(2)}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
        <div className="text-sm text-slate-400 mb-2">52W Low</div>
        <div className="text-2xl font-bold text-white">${data['52w_low']?.toFixed(2)}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
        <div className="text-sm text-slate-400 mb-2">Distance</div>
        <div className="text-2xl font-bold text-white">{data.distance_from_high?.toFixed(1)}%</div>
      </div>
    </div>
  )
}

function RRCard({ data }: any) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-sm text-slate-400">Entry</div>
          <div className="text-xl font-semibold text-white">${data.entry?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-sm text-slate-400">Stop</div>
          <div className="text-xl font-semibold text-red-400">${data.stop?.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-sm text-slate-400">Target</div>
          <div className="text-xl font-semibold text-green-400">${data.target?.toFixed(2)}</div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex justify-between">
          <span className="text-slate-400">Risk/Reward</span>
          <span className="text-white font-semibold">{data.risk_reward_ratio?.toFixed(2)}:1</span>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-slate-400">Risk %</span>
          <span className="text-white font-semibold">{data.risk_percent?.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  )
}

function AlignmentMeters({ data }: any) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="space-y-4">
        {Object.entries(data.timeframes || {}).map(([tf, data]: [string, any]) => (
          <div key={tf} className="flex items-center justify-between">
            <span className="text-slate-400">{tf}</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${data.strength || 50}%` }}
                />
              </div>
              <span className="text-white text-sm">{data.trend}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <span className="text-slate-400">Alignment: </span>
        <span className="text-white font-semibold">{data.alignment}</span>
      </div>
    </div>
  )
}

function InlineNote({ data }: any) {
  return (
    <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="text-yellow-400 font-semibold">⚠️</div>
        <div className="flex-1">
          <div className="text-yellow-400 font-semibold mb-2">Risk Level: {data.risk_level}</div>
          <ul className="list-disc list-inside text-yellow-300 text-sm space-y-1 mb-2">
            {data.key_risks?.map((risk: string, i: number) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
          <p className="text-yellow-300 text-sm">{data.disclaimer}</p>
        </div>
      </div>
    </div>
  )
}

