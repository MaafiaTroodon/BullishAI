'use client'

import { useEffect, useState } from 'react'

export function BotpressInit() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check login state
    if (typeof window !== 'undefined') {
      const checkLogin = () => {
        setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
      }
      
      checkLogin()
      window.addEventListener('storage', checkLogin)
      
      return () => {
        window.removeEventListener('storage', checkLogin)
      }
    }
  }, [])

  // Only render iframe if logged in
  if (!isLoggedIn) {
    return null
  }

  return (
    <iframe
      src="https://cdn.botpress.cloud/webchat/v3.3/shareable.html?configUrl=https://files.bpcontent.cloud/2025/10/27/21/20251027211735-6LQXMGEJ.json"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '400px',
        height: '600px',
        border: 'none',
        zIndex: 9999,
      }}
    />
  )
}

