'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'
import { useState } from 'react'

const faqs = [
  {
    question: 'How do I add positions to my portfolio?',
    answer: 'You can add positions by navigating to any stock page and using the "Buy" or "Sell" buttons. Transactions are automatically tracked and reflected in your portfolio.',
  },
  {
    question: 'How do price alerts work?',
    answer: 'Price alerts notify you when a stock reaches a specific price threshold. You can set alerts for price above, price below, percentage changes, or volume spikes. Notifications are sent via email, SMS, or push notifications.',
  },
  {
    question: 'Is my financial data secure?',
    answer: 'Yes, we use bank-level encryption (AES-256) to protect your data. All API communications are secured with TLS/SSL, and we never share your information with third parties without your explicit consent.',
  },
  {
    question: 'How accurate is the portfolio valuation?',
    answer: 'Portfolio valuations use real-time market data from multiple providers. Prices are updated every few seconds during market hours, ensuring accurate mark-to-market calculations.',
  },
  {
    question: 'Can I export my portfolio data?',
    answer: 'Yes, you can export your portfolio data in CSV or JSON format from the dashboard. API users can also programmatically access all portfolio data.',
  },
  {
    question: 'What markets are supported?',
    answer: 'Currently, we support US stock markets (NYSE, NASDAQ) with real-time data. We\'re working on adding support for international markets and cryptocurrencies.',
  },
]

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80"
            alt="Support"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Support</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  We're here to help you succeed
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* FAQ Section */}
        <Reveal variant="fade">
          <div className="mb-16">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
            </Reveal>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <Reveal key={faq.question} variant="fade" delay={idx * 0.05}>
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                      onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-800/50 transition"
                    >
                      <span className="text-white font-semibold">{faq.question}</span>
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                          openIndex === idx ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openIndex === idx && (
                      <div className="px-6 pb-4">
                        <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Contact Form */}
        <Reveal variant="fade" delay={0.3}>
          <div className="bg-slate-800/50 rounded-2xl p-8 md:p-12 border border-slate-700">
            <Reveal variant="rise">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Contact Support</h2>
            </Reveal>
            <Reveal variant="fade" delay={0.1}>
              <form className="max-w-2xl mx-auto space-y-6">
                <div>
                  <label className="block text-slate-300 mb-2">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Subject</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Message</label>
                  <textarea
                    rows={6}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Tell us more about your question or issue..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Send Message
                </button>
              </form>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

