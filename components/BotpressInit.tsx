'use client'

import { useEffect } from 'react'

export function BotpressInit() {
  useEffect(() => {
    // Wait for window to be available
    if (typeof window === 'undefined') return
    
    const clientId = process.env.NEXT_PUBLIC_BOTPRESS_CLIENT_ID
    
    if (!clientId) {
      console.log('Botpress Client ID not configured')
      return
    }

    // Check if already initialized
    if (window.botpressWebChat) {
      console.log('Botpress already initialized')
      return
    }

    // Load the Botpress script
    const script = document.createElement('script')
    script.src = 'https://cdn.botpress.cloud/webchat/v1/inject.js'
    script.async = true
    
    script.onload = () => {
      console.log('Botpress script loaded')
      
      // Small delay to ensure script is ready
      setTimeout(() => {
        if (window.botpressWebChat) {
          try {
            window.botpressWebChat.init({
              clientId: clientId,
              composerPlaceholder: 'Ask about stocks...',
              botName: 'BullishAI',
              botConversationDescription: 'Stock and market assistant',
            })
            console.log('Botpress initialized successfully')
          } catch (error) {
            console.error('Error initializing Botpress:', error)
          }
        }
      }, 500)
    }
    
    script.onerror = () => {
      console.error('Failed to load Botpress script')
    }
    
    document.body.appendChild(script)
    
    return () => {
      // Cleanup if component unmounts
      const existingScript = document.querySelector('script[src*="botpress.cloud/webchat"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  return null
}

// Declare global type
declare global {
  interface Window {
    botpressWebChat?: {
      init: (config: any) => void
      onEvent: (callback: (event: any) => void) => void
      sendEvent: (event: any) => void
    }
  }
}

