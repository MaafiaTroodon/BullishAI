/**
 * Footer wrapper that conditionally renders footer
 * Only shows on non-landing pages
 */

'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './Footer'

export function FooterWrapper() {
  const pathname = usePathname()
  
  // Show footer on all pages including landing page
  return <Footer />
}

