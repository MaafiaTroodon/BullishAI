import { NextResponse } from 'next/server'
import { loadKnowledgeBase } from '@/lib/chat-knowledge-base'
import { findBestMatch } from '@/lib/ai-knowledge-trainer'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || 'market performance'
    
    const kb = await loadKnowledgeBase()
    const matches = findBestMatch(query, kb, 3)
    
    return NextResponse.json({
      query,
      kbSize: kb.length,
      matches: matches.map(m => ({
        question: m.question,
        answer: m.answer,
        section: m.section,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

