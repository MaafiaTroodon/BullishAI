import { NextRequest, NextResponse } from 'next/server'
import { generateReboundData } from '@/lib/screens/mock-data'

export async function GET(req: NextRequest) {
  try {
    const items = generateReboundData()
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      items,
    })
  } catch (error: any) {
    console.error('Undervalued rebound API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rebound data' },
      { status: 500 }
    )
  }
}

