import { NextRequest, NextResponse } from 'next/server'
import { authClient } from '@/lib/auth-server'
import { getUpcomingDividends } from '@/lib/dividend-processor'

export async function GET(req: NextRequest) {
  try {
    const session = await authClient.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dividends = await getUpcomingDividends(session.user.id)

    return NextResponse.json({
      dividends,
      count: dividends.length,
    })
  } catch (error: any) {
    console.error('Upcoming dividends error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch upcoming dividends' },
      { status: 500 }
    )
  }
}

