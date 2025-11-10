import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'components', 'stock_qa_100k.json')
    
    // Read file line by line (JSONL format)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.trim().split('\n')
    
    // Parse each line as JSON
    const data = lines
      .map((line, index) => {
        try {
          return JSON.parse(line)
        } catch (error) {
          console.error(`Error parsing line ${index + 1}:`, error)
          return null
        }
      })
      .filter(item => item !== null)
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Failed to load knowledge base:', error)
    return NextResponse.json(
      { error: 'Failed to load knowledge base' },
      { status: 500 }
    )
  }
}

