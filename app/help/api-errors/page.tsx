'use client'

import { Reveal } from '@/components/anim/Reveal'
import Link from 'next/link'

export default function APIErrors() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal variant="fade">
          <Link href="/help" className="text-blue-400 hover:text-blue-300 mb-6 inline-block">
            ← Back to Help Center
          </Link>
        </Reveal>
        <Reveal variant="rise">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">API Errors</h1>
        </Reveal>
        <Reveal variant="fade" delay={0.2}>
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
            <p className="text-slate-300 leading-relaxed mb-4">
              If you encounter API errors, check your API key is valid and hasn't expired. Verify you're not exceeding rate limits. Review error messages for specific guidance.
            </p>
            <p className="text-slate-300 leading-relaxed">
              Implement proper error handling in your code with retry logic and exponential backoff. Check the API documentation for correct endpoint usage and required parameters.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

