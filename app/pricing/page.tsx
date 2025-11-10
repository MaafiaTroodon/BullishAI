'use client'

import { Reveal } from '@/components/anim/Reveal'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started with portfolio tracking',
    features: [
      'Real-time portfolio tracking',
      'Basic price alerts',
      'Portfolio analytics',
      'Watchlist management',
      'Community support',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For serious investors who want advanced features',
    features: [
      'Everything in Free',
      'Advanced AI insights',
      'Unlimited price alerts',
      'Priority data updates',
      'Advanced charting tools',
      'Email & SMS notifications',
      'Priority support',
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For institutions and high-volume traders',
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'Advanced security features',
      'White-label options',
      'Custom reporting',
      '24/7 phone support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[40vh] min-h-[300px] overflow-hidden bg-gradient-to-br from-blue-900/20 via-slate-900 to-purple-900/20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGMwIDIuMjA5LTEuNzkxIDQtNCA0cy00LTEuNzkxLTQtNCAxLjc5MS00IDQtNCA0IDEuNzkxIDQgNHptMTYgMTZjMCAyLjIwOS0xLjc5MSA0LTQgNHMtNC0xLjc5MS00LTQgMS43OTEtNCA0LTQgNCAxLjc5MSA0IDR6IiBmaWxsPSIjM2I0MDUxIiBmaWxsLW9wYWNpdHk9IjAuNCIvPjwvZz48L3N2Zz4=')] opacity-20" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Pricing</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  Choose the plan that fits your investment needs
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, idx) => (
            <Reveal key={plan.name} variant="rise" delay={idx * 0.1}>
              <div
                className={`bg-slate-800/50 rounded-2xl p-8 border-2 transition-all hover:shadow-xl hover:shadow-blue-500/10 ${
                  plan.popular
                    ? 'border-blue-500 scale-105 relative'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && (
                      <span className="text-slate-400 text-lg ml-2">/{plan.period}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        {/* FAQ Section */}
        <Reveal variant="fade" delay={0.4}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Reveal variant="rise" delay={0.1}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Can I change plans later?</h3>
                  <p className="text-slate-400 text-sm">
                    Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.2}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Is there a free trial?</h3>
                  <p className="text-slate-400 text-sm">
                    Pro plans come with a 14-day free trial. No credit card required to start.
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">What payment methods do you accept?</h3>
                  <p className="text-slate-400 text-sm">
                    We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.
                  </p>
                </div>
              </Reveal>
              <Reveal variant="rise" delay={0.4}>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Do you offer refunds?</h3>
                  <p className="text-slate-400 text-sm">
                    Yes, we offer a 30-day money-back guarantee on all paid plans.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

