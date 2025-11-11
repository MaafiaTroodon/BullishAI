import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/watchlist', '/alerts', '/settings', '/wallet', '/history', '/calendar']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check for session token in cookies
  const sessionToken = request.cookies.get('better-auth.session_token')
  const hasSession = !!sessionToken
  
  // If accessing sign-in/sign-up while logged in, redirect to dashboard
  if ((pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup')) && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Check if route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  
  // If accessing protected route without session, redirect to sign-in
  if (isProtected && !hasSession) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(signInUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
