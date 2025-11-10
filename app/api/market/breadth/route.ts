import { NextRequest, NextResponse } from 'next/server'
import { safeJsonFetcher } from '@/lib/safeFetch'

export async function GET(req: NextRequest) {
  try {
    // Fetch major indices for breadth calculation
    const symbols = ['SPY', 'QQQ', 'DIA', 'IWM']
    const quotes = await Promise.all(
      symbols.map(symbol =>
        fetch(`${req.nextUrl.origin}/api/quote?symbol=${symbol}`)
          .then(r => r.json())
          .catch(() => null)
      )
    )

    // Calculate breadth metrics (simplified - in production, use actual adv/dec data)
    const advancing = quotes.filter(q => q && q.changePercent > 0).length
    const declining = quotes.filter(q => q && q.changePercent < 0).length
    
    // Mock volume data (in production, fetch from market data provider)
    const volumeUp = Math.floor(Math.random() * 2000) + 1000
    const volumeDown = Math.floor(Math.random() * 2000) + 1000
    
    return NextResponse.json({
      advancing,
      declining,
      volume_up: volumeUp,
      volume_down: volumeDown,
      new_highs: Math.floor(Math.random() * 100) + 50,
      new_lows: Math.floor(Math.random() * 50) + 10,
      adv_dec_ratio: advancing / (declining || 1),
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Breadth API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market breadth' },
      { status: 500 }
    )
  }
}

