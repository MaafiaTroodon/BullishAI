'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

const docSections = [
  {
    title: 'Authentication',
    description: 'Learn how to authenticate API requests and manage API keys securely.',
    icon: '🔐',
  },
  {
    title: 'Portfolio Endpoints',
    description: 'Access portfolio data, holdings, and performance metrics programmatically.',
    icon: '📊',
  },
  {
    title: 'Quote & Market Data',
    description: 'Retrieve real-time and historical stock quotes, prices, and market information.',
    icon: '📈',
  },
  {
    title: 'Alerts API',
    description: 'Create, manage, and monitor price alerts and notifications via API.',
    icon: '🔔',
  },
  {
    title: 'Webhooks',
    description: 'Set up webhooks to receive real-time notifications for portfolio events.',
    icon: '🔗',
  },
  {
    title: 'Rate Limits',
    description: 'Understand API rate limits, throttling, and best practices for optimal performance.',
    icon: '⚡',
  },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&q=80"
            alt="Documentation"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Documentation</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Comprehensive guides and API reference for developers
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Quick Start */}
        <Reveal variant="fade">
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Quick Start</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <div className="bg-slate-950 rounded-xl p-6 border border-slate-700 overflow-x-auto">
                <pre className="text-slate-300 text-sm">
                  <code>{`# Install the BullishAI SDK
npm install @bullishai/sdk

# Initialize the client
import { BullishAI } from '@bullishai/sdk';

const client = new BullishAI({
  apiKey: 'your-api-key'
});

# Fetch portfolio data
const portfolio = await client.portfolio.get();
console.log(portfolio.totals.tpv);`}</code>
                </pre>
              </div>
            </Reveal>
          </div>
        </Reveal>

        {/* Documentation Sections */}
        <Reveal variant="fade" delay={0.2}>
          <div className="mb-12">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6">Documentation Sections</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {docSections.map((section, idx) => (
                <Reveal key={section.title} variant="rise" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer">
                    <div className="text-4xl mb-3">{section.icon}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{section.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{section.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Code Examples */}
        <Reveal variant="fade" delay={0.3}>
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6">Usage Examples</h2>
            </Reveal>
            <div className="space-y-6">
              <Reveal variant="fade" delay={0.1}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Get Portfolio Holdings</h3>
                  <div className="bg-slate-950 rounded-xl p-6 border border-slate-700 overflow-x-auto">
                    <pre className="text-slate-300 text-sm">
                      <code>{`const holdings = await client.portfolio.holdings();
holdings.items.forEach(holding => {
  console.log(\`\${holding.symbol}: \${holding.totalShares} shares\`);
});`}</code>
                    </pre>
                  </div>
                </div>
              </Reveal>
              <Reveal variant="fade" delay={0.2}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Create Price Alert</h3>
                  <div className="bg-slate-950 rounded-xl p-6 border border-slate-700 overflow-x-auto">
                    <pre className="text-slate-300 text-sm">
                      <code>{`const alert = await client.alerts.create({
  symbol: 'AAPL',
  type: 'price_above',
  value: 200
});

console.log(\`Alert created: \${alert.id}\`);`}</code>
                    </pre>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal variant="fade" delay={0.4}>
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-12 border border-slate-700 text-center">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-4">Need Help?</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <a
                href="/support"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition hover:scale-[0.98]"
              >
                Contact Support
              </a>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

