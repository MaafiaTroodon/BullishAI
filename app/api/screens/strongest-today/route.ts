import { NextRequest, NextResponse } from 'next/server'
import { generateTodayData } from '@/lib/screens/mock-data'

export async function GET(req: NextRequest) {
  try {
    const items = generateTodayData()
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      items,
    })
  } catch (error: any) {
    console.error('Strongest today API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch today data' },
      { status: 500 }
    )
  }
}

