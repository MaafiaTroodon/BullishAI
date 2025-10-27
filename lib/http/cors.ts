import { NextResponse } from 'next/server'

export function setCORSHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=45')
  
  return response
}

export function handleOptionsRequest(): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  return setCORSHeaders(response)
}

