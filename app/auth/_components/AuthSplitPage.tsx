'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { AlertCircle, Eye, EyeOff, Lock, Mail, TrendingUp, User } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type AuthMode = 'signin' | 'signup'

type AuthSplitPageProps = {
  initialMode: AuthMode
}

export default function AuthSplitPage({ initialMode }: AuthSplitPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, isPending: sessionLoading } = authClient.useSession()
  const vantaRef = useRef<HTMLDivElement | null>(null)
  const vantaEffect = useRef<any>(null)
  const [vantaReady, setVantaReady] = useState(false)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [loadingTimeout, setLoadingTimeout] = useState(false)

  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signInShowPassword, setSignInShowPassword] = useState(false)
  const [signInLoading, setSignInLoading] = useState(false)
  const [signInError, setSignInError] = useState('')

  const [name, setName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [signUpError, setSignUpError] = useState('')

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (sessionLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
    setLoadingTimeout(false)
  }, [sessionLoading])

  const hasRedirected = useRef(false)
  useEffect(() => {
    if ((!sessionLoading || loadingTimeout) && session?.user && !hasRedirected.current) {
      hasRedirected.current = true
      const next = searchParams.get('next') || '/dashboard'
      router.replace(next)
    }
  }, [session?.user, sessionLoading, loadingTimeout])

  useEffect(() => {
    const win = window as typeof window & { VANTA?: any; THREE?: any }
    if (!vantaReady || !vantaRef.current || vantaEffect.current || !win.VANTA?.NET || !win.THREE) return
    vantaEffect.current = win.VANTA.NET({
      el: vantaRef.current,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: 0xff3f81,
      backgroundColor: 0x23153c,
      points: 10,
      maxDistance: 20,
      spacing: 15,
      showDots: true,
    })
    return () => {
      vantaEffect.current?.destroy?.()
      vantaEffect.current = null
    }
  }, [vantaReady])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setSignInError('')
    setSignUpError('')
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInLoading(true)
    setSignInError('')

    try {
      const result = await authClient.signIn.email({
        email: signInEmail,
        password: signInPassword,
      })

      if (result?.error) {
        setSignInError(result.error.message || 'Failed to sign in')
        setSignInLoading(false)
        return
      }

      const next = searchParams.get('next') || '/dashboard'
      router.replace(next)
    } catch (err: any) {
      setSignInError(err?.message || 'An error occurred. Please try again.')
      setSignInLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (signUpPassword !== confirmPassword) {
      setSignUpError('Passwords do not match')
      return
    }

    if (signUpPassword.length < 8) {
      setSignUpError('Password must be at least 8 characters')
      return
    }

    setSignUpLoading(true)
    setSignUpError('')

    try {
      const result = await authClient.signUp.email({
        email: signUpEmail,
        password: signUpPassword,
        name,
      })

      if (result?.error) {
        setSignUpError(result.error.message || 'Failed to create account')
        setSignUpLoading(false)
        return
      }

      router.replace('/dashboard')
    } catch (err: any) {
      setSignUpError(err?.message || 'An error occurred. Please try again.')
      setSignUpLoading(false)
    }
  }

  if (sessionLoading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1222] via-[#0f172a] to-[#0b1222] flex items-center justify-center px-4 py-12">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setVantaReady(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js"
        strategy="afterInteractive"
        onLoad={() => setVantaReady(true)}
      />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-700/60 bg-slate-900/40 shadow-2xl">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-12 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative lg:h-[640px]">
          <div className="flex flex-col lg:block">
            <div
              className={`relative w-full lg:absolute lg:left-0 lg:top-0 lg:h-full lg:w-1/2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === 'signin' ? 'lg:translate-x-0' : 'lg:translate-x-full'
              }`}
            >
              <div ref={vantaRef} className="h-full w-full px-6 py-10 lg:px-12 lg:py-16 relative overflow-hidden">
                <div className="relative z-10 flex h-full flex-col justify-between text-white">
                  <div>
                    <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                      <TrendingUp className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-3xl font-semibold">
                      {mode === 'signin' ? 'Trade smarter. See sooner.' : 'Welcome back.'}
                    </h2>
                    <p className="mt-3 text-sm text-white/80 leading-relaxed">
                      {mode === 'signin'
                        ? 'AI-powered market insights, real-time movers, and clarity that keeps you ahead of the tape.'
                        : 'Your portfolio. Your insights. Right where you left off.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">
                      {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                    </p>
                    <button
                      type="button"
                      onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                      className="mt-4 inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {mode === 'signin' ? 'Register' : 'Login'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`relative w-full lg:absolute lg:left-0 lg:top-0 lg:h-full lg:w-1/2 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mode === 'signin' ? 'lg:translate-x-full' : 'lg:translate-x-0'
              }`}
            >
              <div className="h-full w-full bg-slate-900/70 px-8 py-12 lg:px-12 lg:py-16 backdrop-blur">
                <div className="mx-auto flex h-full max-w-md flex-col justify-center">
                  <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-white">
                      {mode === 'signin' ? 'Login' : 'Create Account'}
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {mode === 'signin'
                        ? 'Sign in to access your BullishAI dashboard.'
                        : 'Start tracking your portfolio with BullishAI.'}
                    </p>
                  </div>

                  <div className="relative">
                    <div className={`transition-all duration-300 ${mode === 'signin' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                      <form onSubmit={handleSignIn} className="space-y-5">
                        {signInError && (
                          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            <span>{signInError}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type="email"
                              value={signInEmail}
                              onChange={(e) => setSignInEmail(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="you@example.com"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type={signInShowPassword ? 'text' : 'password'}
                              value={signInPassword}
                              onChange={(e) => setSignInPassword(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="••••••••"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setSignInShowPassword(!signInShowPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                              aria-label={signInShowPassword ? 'Hide password' : 'Show password'}
                            >
                              {signInShowPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-end text-xs text-slate-400">
                          <span className="cursor-not-allowed opacity-60" title="Forgot password is coming soon">
                            Forgot password?
                          </span>
                        </div>

                        <button
                          type="submit"
                          disabled={signInLoading}
                          className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-90 disabled:opacity-60"
                        >
                          {signInLoading ? 'Signing in...' : 'Sign In'}
                        </button>

                        <p className="text-center text-sm text-slate-400">
                          Don&apos;t have an account?{' '}
                          <button type="button" onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300 font-semibold">
                            Sign up
                          </button>
                        </p>
                      </form>
                    </div>

                    <div className={`transition-all duration-300 ${mode === 'signup' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                      <form onSubmit={handleSignUp} className="space-y-5">
                        {signUpError && (
                          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            <span>{signUpError}</span>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Full Name
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="John Doe"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type="email"
                              value={signUpEmail}
                              onChange={(e) => setSignUpEmail(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="you@example.com"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={signUpPassword}
                              onChange={(e) => setSignUpPassword(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="••••••••"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 pl-11 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="••••••••"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={signUpLoading}
                          className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-90 disabled:opacity-60"
                        >
                          {signUpLoading ? 'Creating account...' : 'Create Account'}
                        </button>

                        <p className="text-center text-sm text-slate-400">
                          Already have an account?{' '}
                          <button type="button" onClick={() => switchMode('signin')} className="text-blue-400 hover:text-blue-300 font-semibold">
                            Sign in
                          </button>
                        </p>

                        <p className="text-xs text-slate-500 text-center">
                          By signing up, you agree to our Terms of Service and Privacy Policy
                        </p>
                      </form>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center lg:hidden">
                    <Link href={mode === 'signin' ? '/auth/signup' : '/auth/signin'} className="text-sm text-slate-400 hover:text-slate-200">
                      {mode === 'signin' ? 'Need an account? Switch to Register' : 'Already have an account? Switch to Login'}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AuthSplitPageSuspense({ initialMode }: AuthSplitPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AuthSplitPage initialMode={initialMode} />
    </Suspense>
  )
}
