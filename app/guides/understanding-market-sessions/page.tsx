'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import Link from 'next/link'

export default function UnderstandingMarketSessions() {
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
              Education
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Understanding Market Sessions</h1>
            <p className="text-xl text-slate-300">Navigate pre-market, regular trading hours, and after-hours sessions with confidence.</p>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.1}>
          <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80"
              alt="Market Sessions"
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Reveal>

        <div className="prose prose-invert max-w-none">
          <Reveal variant="fade" delay={0.2}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Pre-Market Trading (4:00 AM - 9:30 AM ET)</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Pre-market trading occurs before regular market hours. Volume is typically lower, which can lead to wider bid-ask spreads and increased volatility.
              </p>
              <p className="text-slate-300 leading-relaxed">
                This session is useful for reacting to overnight news, earnings announcements, or international market movements. However, be cautious of lower liquidity and potential price gaps.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.3}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Regular Trading Hours (9:30 AM - 4:00 PM ET)</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Regular trading hours offer the highest liquidity and tightest spreads. This is when most institutional and retail traders are active, making it the best time for most trading activities.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Market open (9:30 AM) and close (4:00 PM) often see increased volatility as traders react to overnight news and position for the next day. BullishAI provides real-time data updates throughout regular hours.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.4}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">After-Hours Trading (4:00 PM - 8:00 PM ET)</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                After-hours trading allows you to react to earnings reports and news released after market close. Similar to pre-market, liquidity is lower and spreads can be wider.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Use after-hours trading cautiously, as price movements can be more volatile and may not reflect true market sentiment. Prices often gap at the next day's open.
              </p>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={0.5}>
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Best Practices</h2>
              <ul className="text-slate-300 space-y-2 list-disc list-inside">
                <li>Monitor market session indicators in BullishAI to know when markets are open</li>
                <li>Use limit orders during extended hours to avoid unfavorable fills</li>
                <li>Be aware that not all stocks trade during extended hours</li>
                <li>Consider the impact of market sessions on your alert triggers</li>
                <li>Plan your trading strategy around regular hours for better execution</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

