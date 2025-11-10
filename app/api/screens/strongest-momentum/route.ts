import { NextRequest, NextResponse } from 'next/server'
import { generateMomentumData } from '@/lib/screens/mock-data'

export async function GET(req: NextRequest) {
  try {
    const items = generateMomentumData()
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      items,
    })
  } catch (error: any) {
    console.error('Strongest momentum API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch momentum data' },
      { status: 500 }
    )
  }
}

