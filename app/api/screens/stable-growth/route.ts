import { NextRequest, NextResponse } from 'next/server'
import { generateStableData } from '@/lib/screens/mock-data'

export async function GET(req: NextRequest) {
  try {
    const items = generateStableData()
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      items,
    })
  } catch (error: any) {
    console.error('Stable growth API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stable growth data' },
      { status: 500 }
    )
  }
}

