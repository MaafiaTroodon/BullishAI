'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import useSWR from 'swr'
import Link from 'next/link'
import { TiltCard } from '@/components/TiltCard'
import { useRouter } from 'next/navigation'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await res.text()
    console.error('Non-JSON response:', text.substring(0, 200))
    throw new Error('Invalid response format')
  }
  return res.json()
}

interface StockCard {
  symbol: string
  price: number
  changePct: number
  category: string
}

export function PopularToday() {
  const router = useRouter()
  const [stockCards, setStockCards] = useState<StockCard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch popular stock symbols
  const { data: popularData } = useSWR('/api/popular-stocks', fetcher, {
    refreshInterval: 600000, // Refresh every 10 minutes
  })

  // Fetch quotes for popular stocks
  const symbols = popularData?.stocks || []
  const symbolsParam = symbols.join(',')
  
  const { data: quotesData } = useSWR(
    symbols.length > 0 ? `/api/quotes?symbols=${symbolsParam}` : null,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  useEffect(() => {
    if (quotesData?.quotes && Array.isArray(quotesData.quotes)) {
      const cards = quotesData.quotes
        .filter((q: any) => q.data && q.data.price > 0)
        .map((q: any) => ({
          symbol: q.symbol,
          price: q.data.price || q.data.c || 0,
          changePct: q.data.dp || q.data.changePercent || 0,
          category: 'STOCK',
        }))
        .slice(0, 8)

      setStockCards(cards)
      setIsLoading(false)
    }
  }, [quotesData])

  if (isLoading || stockCards.length === 0) {
    return (
      <section className="max-w-[95%] mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
            <div className="h-2 w-2 bg-white rounded-full"></div>
          </div>
          <h2 className="text-2xl font-bold text-white">Popular today</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded mb-2"></div>
              <div className="h-8 bg-slate-700 rounded mb-2"></div>
              <div className="h-6 bg-slate-700 rounded mb-2"></div>
              <div className="h-4 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="max-w-[95%] mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center">
          <div className="h-2 w-2 bg-white rounded-full"></div>
        </div>
        <h2 className="text-2xl font-bold text-white">Popular today</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stockCards.map((stock) => {
          const isPositive = stock.changePct >= 0
          const changeColor = isPositive ? 'text-green-600' : 'text-red-600'

          return (
            <TiltCard className="rounded-lg" hoverScale={1.05} rotateAmplitude={10} key={stock.symbol}>
              <Link
                href={`/stocks/${stock.symbol}`}
                className="bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 p-4 transition cursor-pointer block"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs text-slate-400 uppercase">{stock.category}</span>
                  <span className="text-xs font-semibold text-slate-300">${stock.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-white">{stock.symbol}</span>
                  <div className={`flex items-center gap-1 ${changeColor}`}>
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold">
                      {isPositive ? '+' : ''}{stock.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Link>
            </TiltCard>
          )
        })}
      </div>
    </section>
  )
}

