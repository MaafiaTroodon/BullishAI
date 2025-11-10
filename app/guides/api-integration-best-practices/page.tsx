'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function APIIntegrationBestPractices() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/guides" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Guides
          </Link>
        </Reveal>

        <Reveal variant="rise">
          <div className="mb-8">
            <span className="inline-block px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-semibold rounded-full mb-4">
              Development
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">API Integration Best Practices</h1>
            <p className="text-xl text-slate-300">Learn how to efficiently integrate BullishAI's API into your applications with proper error handling and rate limiting.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80"
              alt="API Integration"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Authentication & Security</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Always use secure authentication methods when integrating BullishAI's API. Store API keys in environment variables, never commit them to version control.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Implement proper token refresh mechanisms and handle authentication errors gracefully. Use HTTPS for all API requests to ensure data security.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Rate Limiting & Caching</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Respect API rate limits to avoid service interruptions. Implement exponential backoff for retry logic and cache responses when appropriate to reduce API calls.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Use request batching when possible to fetch multiple symbols in a single API call. This improves efficiency and reduces the number of requests.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Error Handling</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Implement comprehensive error handling for network failures, API errors, and data validation issues. Provide meaningful error messages to users.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Handle different HTTP status codes appropriately: retry on 5xx errors, handle 4xx errors with user-friendly messages, and implement circuit breakers for persistent failures.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Performance Optimization</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>Use WebSocket connections for real-time data when available</li>
                <li>Implement request debouncing for user-triggered API calls</li>
                <li>Cache frequently accessed data with appropriate TTL values</li>
                <li>Use pagination for large data sets</li>
                <li>Monitor API response times and optimize slow endpoints</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

