'use client'

import { useState, useEffect } from 'react'
import { Webchat, WebchatProvider, Fab, getClient, Configuration } from '@botpress/webchat'

const clientId = process.env.NEXT_PUBLIC_BOTPRESS_CLIENT_ID || "b1524900-7e8c-4649-8460-196542907801"

const configuration: Configuration = {
  composerPlaceholder: 'Ask about stocks...',
  botName: 'BullishAI',
  botConversationDescription: 'Stock and market assistant',
  color: '#4F46E5',
}

export function BotpressInit() {
  const [isWebchatOpen, setIsWebchatOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check login state
    if (typeof window !== 'undefined') {
      const checkLogin = () => {
        setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true')
      }
      
      checkLogin()
      
      // Listen for storage changes
      window.addEventListener('storage', checkLogin)
      
      return () => {
        window.removeEventListener('storage', checkLogin)
      }
    }
  }, [])

  const toggleWebchat = () => {
    if (!isLoggedIn) {
      alert('Please sign in to use AI chat')
      return
    }
    setIsWebchatOpen((prevState) => !prevState)
  }

  // Don't show anything if not logged in
  if (!isLoggedIn) {
    return null
  }

  const client = getClient({ clientId })

  return (
    <WebchatProvider client={client} configuration={configuration}>
      <Fab onClick={toggleWebchat} />
      {isWebchatOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '400px',
            height: '600px',
            zIndex: 9999,
          }}
        >
          <Webchat />
        </div>
      )}
    </WebchatProvider>
  )
}

