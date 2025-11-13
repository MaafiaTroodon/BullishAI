import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import { getDividendHistory } from '@/lib/dividend-processor'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const history = await getDividendHistory(session.user.id, limit)

    return NextResponse.json({
      history,
      count: history.length,
    })
  } catch (error: any) {
    console.error('Dividend history error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dividend history' },
      { status: 500 }
    )
  }
}

