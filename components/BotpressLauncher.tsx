'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BotpressLauncherProps {
  className?: string
}

export function BotpressLauncher({ className }: BotpressLauncherProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check login state
    if (typeof window !== 'undefined') {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
      
      // Listen for storage changes to update login state
      const handleStorageChange = () => {
        setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
      }
      window.addEventListener('storage', handleStorageChange)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
      }
    }
  }, [])

  useEffect(() => {
    // Initialize Botpress when user logs in
    if (isLoggedIn && typeof window !== 'undefined' && !isInitialized) {
      const clientId = process.env.NEXT_PUBLIC_BOTPRESS_CLIENT_ID
      
      if (clientId && !window.botpressWebChat) {
        console.log('Loading Botpress Webchat script...')
        
        // Load the Botpress script
        const script = document.createElement('script')
        script.src = 'https://cdn.botpress.cloud/webchat/v1/inject.js'
        script.async = true
        
        script.onload = () => {
          console.log('Botpress script loaded, initializing...')
          
          if (window.botpressWebChat && clientId) {
            try {
              window.botpressWebChat.init({
                clientId: clientId,
                composerPlaceholder: 'Ask about stocks...',
                botConversationDescription: 'Stock and market assistant',
                botName: 'BullishAI',
                companyName: 'BullishAI',
                website: 'https://bullish-ai.com',
                useSessionStorage: true,
                enablePersistHistory: true,
                enableTranscriptDownload: false,
                showPoweredBy: false,
              })
              
              window.botpressWebChat.onEvent((event: any) => {
                if (event.type === 'show') {
                  console.log('Botpress opened')
                }
              })
              
              setIsInitialized(true)
            } catch (error) {
              console.error('Error initializing Botpress:', error)
            }
          }
        }
        
        document.body.appendChild(script)
      } else if (clientId && window.botpressWebChat) {
        setIsInitialized(true)
      }
    }
  }, [isLoggedIn, isInitialized])

  const handleClick = async () => {
    if (!isLoggedIn) {
      // Show sign-in prompt and redirect
      alert('Please sign in to use AI chat')
      router.push('/auth/signin')
      return
    }

    try {
      // Try multiple approaches to open Botpress chat
      
      // Approach 1: Click the FAB button programmatically
      const fabButton = document.querySelector('[id*="bp-widget"] button, [class*="bp-widget"] button')
      if (fabButton) {
        (fabButton as HTMLElement).click()
        return
      }
      
      // Approach 2: Try to find and trigger the webchat
      const webchatContainer = document.querySelector('[class*="bp-webchat"], [id*="bp-webchat"]')
      if (webchatContainer) {
        (webchatContainer as HTMLElement).style.display = 'block'
        ;(webchatContainer as HTMLElement).style.zIndex = '9999'
        return
      }
      
      // Approach 3: Use the Botpress API if available and fully initialized
      if (window.botpressWebChat && window.botpressWebChat.sendEvent) {
        // Check if the method is actually callable by checking for required properties
        const hasIframe = 'iframeWindow' in window.botpressWebChat
        if (hasIframe) {
          window.botpressWebChat.sendEvent({ type: 'show' })
          return
        }
      }
      
      // Approach 4: Fallback - just scroll to make the button visible
      console.log('Botpress chat is loading. The floating chat button should appear in the bottom right corner.')
      
    } catch (error) {
      console.error('Error opening Botpress:', error)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 ${className}`}
      aria-label="Open AI chat"
    >
      <MessageCircle className="h-7 w-7" />
    </button>
  )
}

// Declare global types for Botpress
declare global {
  interface Window {
    botpressWebChat?: {
      init: (config: any) => void
      onEvent: (callback: (event: any) => void) => void
      sendEvent: (event: any) => void
    }
  }
}

