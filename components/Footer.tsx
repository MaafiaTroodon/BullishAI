/**
 * Animated Footer Component
 * 5 columns with scroll-triggered animations and hover micro-interactions
 */

'use client'

import Link from 'next/link'
import { Reveal } from './anim/Reveal'
import { StaggerGrid } from './anim/StaggerGrid'

const footerSections = [
  {
    title: 'About',
    links: [
      { label: 'Our Story', href: '/about' },
      { label: 'Team', href: '/team' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'API', href: '/api' },
      { label: 'Integrations', href: '/integrations' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Guides', href: '/guides' },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Status', href: '/status' },
      { label: 'Community', href: '/community' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'Twitter', href: 'https://twitter.com/bullishai', external: true },
      { label: 'LinkedIn', href: 'https://linkedin.com/company/bullishai', external: true },
      { label: 'GitHub', href: 'https://github.com/bullishai', external: true },
      { label: 'Discord', href: 'https://discord.gg/bullishai', external: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {footerSections.map((section, idx) => (
            <Reveal key={section.title} variant="fade" delay={idx * 0.05}>
              <div>
                <Reveal variant="slide-left" delay={0.05}>
                  <h3 className="text-white font-semibold mb-4">{section.title}</h3>
                </Reveal>
                <StaggerGrid staggerDelay={0.04} variant="rise">
                  {section.links.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="block text-slate-400 hover:text-white mb-3 transition group relative"
                    >
                      <span className="relative">
                        {link.label}
                        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white group-hover:w-full transition-all duration-300 ease-out" />
                      </span>
                    </Link>
                  ))}
                </StaggerGrid>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Newsletter (Optional) */}
        <Reveal variant="fade" delay={0.3}>
          <div className="border-t border-slate-800 pt-8 mb-8">
            <div className="max-w-md mx-auto">
              <h3 className="text-white font-semibold mb-4 text-center">Stay Updated</h3>
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition hover:scale-[0.98] active:scale-[0.98]"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </Reveal>

        {/* Legal Line */}
        <Reveal variant="fade" delay={0.4}>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
            <p className="mb-2">
              © 2024 BullishAI. All rights reserved. |{' '}
              <Link href="/privacy" className="hover:text-white transition underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              {' | '}
              <Link href="/terms" className="hover:text-white transition underline-offset-2 hover:underline">
                Terms of Service
              </Link>
            </p>
            <p className="text-xs text-slate-600">
              Not financial advice. This platform is for informational purposes only. Always do your own research.
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  )
}

