import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/home/best-value`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({ stocks: [] }))
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Value picks API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch value picks', stocks: [] },
      { status: 500 }
    )
  }
}
