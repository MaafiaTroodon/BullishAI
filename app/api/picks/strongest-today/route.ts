import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/home/strongest-today`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({ stocks: [] }))
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Strongest today API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch strongest today', stocks: [] },
      { status: 500 }
    )
  }
}
