'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const endpoints = [
  {
    method: 'GET',
    path: '/api/portfolio',
    description: 'Retrieve portfolio holdings and summary data',
  },
  {
    method: 'GET',
    path: '/api/quote?symbol=AAPL',
    description: 'Get real-time quote for a stock symbol',
  },
  {
    method: 'GET',
    path: '/api/alerts',
    description: 'List all price alerts for authenticated user',
  },
  {
    method: 'POST',
    path: '/api/alerts',
    description: 'Create a new price alert',
  },
  {
    method: 'GET',
    path: '/api/portfolio/timeseries',
    description: 'Get historical portfolio value data',
  },
]

export default function APIPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&q=80"
            alt="Code Editor"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">API Documentation</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Build powerful integrations with our RESTful API
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Overview */}
        <Reveal variant="fade">
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Getting Started</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 text-lg leading-relaxed mb-6">
                The BullishAI API provides programmatic access to portfolio data, real-time quotes, alerts, and more. 
                All endpoints require authentication using API keys or OAuth tokens.
              </p>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-3">Base URL</h3>
                <code className="text-blue-400 text-sm">https://api.bullishai.com/v1</code>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* Authentication */}
        <Reveal variant="fade" delay={0.2}>
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Authentication</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-6">
                Include your API key in the Authorization header:
              </p>
              <div className="bg-slate-950 rounded-xl p-6 border border-slate-700 overflow-x-auto">
                <pre className="text-slate-300 text-sm">
                  <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.bullishai.com/v1/portfolio`}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* Endpoints */}
        <Reveal variant="fade" delay={0.3}>
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6">Available Endpoints</h2>
            </Reveal>
            <div className="space-y-4">
              {endpoints.map((endpoint, idx) => (
                <Reveal key={`${endpoint.method}-${endpoint.path}`} variant="fade" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start gap-4">
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        endpoint.method === 'GET' 
                          ? 'bg-blue-600/20 text-blue-400' 
                          : 'bg-emerald-600/20 text-emerald-400'
                      }`}>
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <code className="text-white text-sm font-mono">{endpoint.path}</code>
                        <p className="text-slate-400 text-sm mt-2">{endpoint.description}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Code Example */}
        <Reveal variant="fade" delay={0.4}>
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Example Usage</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <div className="bg-slate-950 rounded-xl p-6 border border-slate-700 overflow-x-auto">
                <pre className="text-slate-300 text-sm">
                  <code>{`// JavaScript Example
const response = await fetch('https://api.bullishai.com/v1/portfolio', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const portfolio = await response.json();
console.log(portfolio.totals.tpv); // Total Portfolio Value`}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal variant="fade" delay={0.5}>
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-slate-700 text-center">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Ready to Build?</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                Get your API key from your account settings and start building powerful integrations today.
              </p>
              <a
                href="/settings"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition hover:scale-[0.98]"
              >
                Get API Key
              </a>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

