import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/watchlist', '/alerts', '/settings', '/wallet', '/history', '/calendar']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for API routes completely - let them handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Skip middleware for static assets
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }
  
  // Check for session token in cookies - try multiple possible cookie names
  const sessionToken = 
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('better-auth_session_token')?.value ||
    request.cookies.get('session_token')?.value
  const hasSession = !!sessionToken
  
  // If accessing sign-in/sign-up while logged in, redirect to dashboard
  // But only if we have a valid session token
  if ((pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup')) && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Check if route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  
  // TEMPORARILY DISABLE PROTECTED ROUTE REDIRECTS to prevent loops
  // Let client-side handle auth checks instead
  // This allows pages to render even if auth is slow/failing
  /*
  if (isProtected && !hasSession) {
    // Check if we're already being redirected from signin (prevent loops)
    const nextParam = request.nextUrl.searchParams.get('next')
    const isRedirectingFromSignin = nextParam === pathname
    
    // Don't redirect if we're in a redirect loop
    if (!isRedirectingFromSignin) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }
  */
  
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
