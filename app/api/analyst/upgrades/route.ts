import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Mock analyst upgrades (in production, fetch from analyst data provider)
    const mockUpgrades = [
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        rating: 'Buy',
        previous_rating: 'Hold',
        target_price: 850.00,
        current_price: 720.50,
        analyst: 'Goldman Sachs',
        reason: 'Strong AI demand outlook',
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        rating: 'Buy',
        previous_rating: 'Neutral',
        target_price: 280.00,
        current_price: 245.30,
        analyst: 'Morgan Stanley',
        reason: 'Production ramp-up and margin improvement',
      },
    ]

    return NextResponse.json({
      upgrades: mockUpgrades.slice(0, limit),
      timestamp: Date.now(),
    })
  } catch (error: any) {
    console.error('Analyst upgrades API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analyst upgrades' },
      { status: 500 }
    )
  }
}

