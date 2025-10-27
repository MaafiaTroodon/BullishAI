'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BotpressLauncherProps {
  className?: string
}

export function BotpressLauncher({ className }: BotpressLauncherProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
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

  const handleClick = () => {
    if (!isLoggedIn) {
      // Show sign-in prompt and redirect
      alert('Please sign in to use AI chat')
      router.push('/auth/signin')
      return
    }

    // For now, show a message that AI chat is being set up
    alert('AI chat is currently being set up. Please check back soon or contact support.')
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

