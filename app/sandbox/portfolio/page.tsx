'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PortfolioChartSandbox } from '@/components/sandbox/PortfolioChartSandbox'
import { PortfolioSummarySandbox } from '@/components/sandbox/PortfolioSummarySandbox'
import dynamic from 'next/dynamic'
const PortfolioHoldingsComp = dynamic(() => import('@/components/PortfolioHoldings').then(m => m.PortfolioHoldings), { ssr: false })

export default function PortfolioSandboxPage() {
  const router = useRouter()
  const featureEnabled = process.env.NEXT_PUBLIC_FEATURE_PORTFOLIO_SANDBOX === 'true'

  useEffect(() => {
    if (!featureEnabled) {
      router.push('/dashboard')
    }
  }, [featureEnabled, router])

  if (!featureEnabled) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting to dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Portfolio Timeseries Sandbox</h1>
          <p className="text-slate-400 text-sm">Experimental portfolio chart with dual-line visualization (Portfolio Value + Net Deposits)</p>
        </div>
        <div className="space-y-6">
          <PortfolioSummarySandbox />
          <PortfolioChartSandbox />
          <PortfolioHoldingsComp />
        </div>
      </main>
    </div>
  )
}

