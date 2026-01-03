'use client'

import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

type AIGateProps = {
  children: React.ReactNode
  title?: string
}

export function AIGate({ children, title = 'AI feature' }: AIGateProps) {
  const { data: session, isPending } = authClient.useSession()
  const isLoggedIn = !!session?.user

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700 text-center">
            <p className="text-slate-200 text-lg font-semibold mb-2">Login required</p>
            <p className="text-slate-400 mb-4">
              Sign in to access {title} and other AI tools.
            </p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
