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

  useEffect(() => {
    // Only load Botpress if logged in
    if (!isLoggedIn || typeof window === 'undefined') return

    const clientId = "b1524900-7e8c-4649-8460-196542907801"
    
    // Check if script already loaded
    if (document.querySelector('script[src*="botpress.cloud"]') || (window as any).botpressWebChat) {
      return
    }

    // Load Botpress inject script
    const script = document.createElement('script')
    script.src = `https://cdn.botpress.cloud/webchat/v1/inject.js`
    script.async = true
    
    script.onload = () => {
      // Initialize Botpress after script loads
      if ((window as any).botpressWebChat) {
        try {
          (window as any).botpressWebChat.init({
            clientId: clientId,
            composerPlaceholder: 'Ask about stocks...',
            botName: 'BullishAI',
            botConversationDescription: 'Stock and market assistant',
          })
          console.log('Botpress initialized')
        } catch (error) {
          console.error('Error initializing Botpress:', error)
        }
      }
    }

    document.body.appendChild(script)
  }, [isLoggedIn])

  return null
}

