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
    if (document.querySelector('script[src*="botpress.cloud"]')) {
      return
    }

    // Load Botpress embed script
    const script = document.createElement('script')
    script.src = `https://cdn.botpress.cloud/webchat/shareable.js`
    script.type = 'module'
    
    script.onload = () => {
      // Initialize Botpress inline script after the module loads
      const inlineScript = document.createElement('script')
      inlineScript.type = 'module'
      inlineScript.textContent = `
        import { Webchat } from 'https://cdn.botpress.cloud/webchat/shareable.js'
        Webchat.init({
          clientId: '${clientId}',
          composerPlaceholder: 'Ask about stocks...',
          botName: 'BullishAI'
        })
      `
      document.body.appendChild(inlineScript)
    }

    document.body.appendChild(script)
  }, [isLoggedIn])

  return null
}

