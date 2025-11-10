'use client'

import { Reveal } from '@/components/anim/Reveal'
import Image from 'next/image'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <Reveal variant="fade">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80"
            alt="Contact Us"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <Reveal variant="rise" delay={0.2}>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Contact Us</h1>
              </Reveal>
              <Reveal variant="rise" delay={0.3}>
                <p className="text-xl text-slate-300 max-w-2xl">
                  We'd love to hear from you. Get in touch with our team.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <Reveal variant="fade">
            <div>
              <Reveal variant="rise">
                <h2 className="text-3xl font-bold text-white mb-6">Send us a message</h2>
              </Reveal>
              <Reveal variant="fade" delay={0.1}>
                <form className="space-y-6">
                  <div>
                    <label className="block text-slate-300 mb-2">Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-2">Email</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-2">Subject</label>
                    <select className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>General Inquiry</option>
                      <option>Technical Support</option>
                      <option>Sales</option>
                      <option>Partnership</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-2">Message</label>
                    <textarea
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Tell us how we can help..."
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

          {/* Contact Info */}
          <Reveal variant="fade" delay={0.2}>
            <div>
              <Reveal variant="rise">
                <h2 className="text-3xl font-bold text-white mb-6">Other ways to reach us</h2>
              </Reveal>
              <div className="space-y-6">
                <Reveal variant="rise" delay={0.1}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Email</h3>
                        <p className="text-slate-400 text-sm mb-2">General inquiries</p>
                        <a href="mailto:hello@bullishai.com" className="text-blue-400 hover:text-blue-300 transition">
                          hello@bullishai.com
                        </a>
                      </div>
                    </div>
                  </div>
                </Reveal>
                <Reveal variant="rise" delay={0.2}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Support</h3>
                        <p className="text-slate-400 text-sm mb-2">Technical support</p>
                        <a href="mailto:support@bullishai.com" className="text-blue-400 hover:text-blue-300 transition">
                          support@bullishai.com
                        </a>
                      </div>
                    </div>
                  </div>
                </Reveal>
                <Reveal variant="rise" delay={0.3}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Sales</h3>
                        <p className="text-slate-400 text-sm mb-2">Enterprise and partnerships</p>
                        <a href="mailto:sales@bullishai.com" className="text-blue-400 hover:text-blue-300 transition">
                          sales@bullishai.com
                        </a>
                      </div>
                    </div>
                  </div>
                </Reveal>
                <Reveal variant="rise" delay={0.4}>
                  <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Office</h3>
                        <p className="text-slate-400 text-sm">
                          123 Financial District<br />
                          San Francisco, CA 94105<br />
                          United States
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

