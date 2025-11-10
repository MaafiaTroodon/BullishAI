/**
 * Footer wrapper that conditionally renders footer
 * Only shows on non-landing pages
 */

'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './Footer'

export function FooterWrapper() {
  const pathname = usePathname()
  
  // Don't show footer on landing page (it has its own footer)
  if (pathname === '/') {
    return null
  }
  
  return <Footer />
}

