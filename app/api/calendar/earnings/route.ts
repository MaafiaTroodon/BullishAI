import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const when = searchParams.get('when') || 'today'

    // Mock earnings data (in production, fetch from earnings calendar API)
    const mockEarnings = [
      { symbol: 'AAPL', name: 'Apple Inc.', time: 'After Market', estimated_eps: 2.10, implied_move: 3.5, current_price: 185.50 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', time: 'After Market', estimated_eps: 2.95, implied_move: 2.8, current_price: 420.30 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', time: 'After Market', estimated_eps: 1.50, implied_move: 4.2, current_price: 150.20 },
    ]

    return NextResponse.json({
      earnings: when === 'today' ? mockEarnings : [],
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Earnings calendar API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch earnings calendar' },
      { status: 500 }
    )
  }
}
