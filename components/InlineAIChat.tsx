'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles, TrendingUp, TrendingDown, X } from 'lucide-react'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  data?: {
    symbol?: string
    price?: number
    change?: number
    changePct?: number
  }
}

interface InlineAIChatProps {
  isLoggedIn: boolean
  focusSymbol?: string
}

export function InlineAIChat({ isLoggedIn, focusSymbol }: InlineAIChatProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load chat history from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bullishai_chat_history')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            // Convert timestamp strings back to Date objects
            const messagesWithDates = parsed.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }))
            setMessages(messagesWithDates)
            if (messagesWithDates.length > 0) {
              setIsExpanded(true)
            }
          }
        } catch (e) {
          console.error('Failed to load chat history:', e)
        }
      }
    }
  }, [])

  // Save chat history to localStorage
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('bullishai_chat_history', JSON.stringify(messages))
    }
  }, [messages])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-expand and set focus symbol if provided
  useEffect(() => {
    if (focusSymbol) {
      setIsExpanded(true)
      setInputValue(`Tell me about ${focusSymbol}`)
      // Focus the input after a brief delay
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      // Auto-send the message
      setTimeout(() => {
        handleSend(`${focusSymbol} current price and analysis`)
      }, 200)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSymbol])

  // Initialize greeting message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: "**BullishAI Market Analyst** here 👋\n\nI provide real-time stock data, prices, news, and market insights. Ask me about any ticker or market topic.\n\n*Try: \"AAPL price\", \"NVDA news\", or \"trending stocks\"*",
          sender: 'bot',
          timestamp: new Date(),
        },
      ])
    }
  }, [])

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || inputValue
    if (!messageToSend.trim() || !isLoggedIn) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageToSend,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const query = messageToSend
    if (!customMessage) {
      setInputValue('')
    }
    setIsTyping(true)

    // Call API for intelligent response
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sessionId: 'inline-home' }),
      })

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type')
      let data: any
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.error('Non-JSON response from /api/ai:', text.substring(0, 200))
        throw new Error('Invalid response format from API')
      }

      if (!response.ok || data.error) {
        console.error('AI API error:', data.error || 'Unknown error')
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `Error: ${data.error || 'Failed to get AI response'}`,
          sender: 'bot',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botMessage])
        setIsTyping(false)
        return
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer || data.response || "Unable to generate response at this time.",
        sender: 'bot',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error('Chat API error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble processing that request. Please try again or ask about a different stock.",
        sender: 'bot',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    return text
      .split(/(\*\*.*?\*\*|\*.*?\*|\n)/)
      .map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
        } else if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>
        } else if (part === '\n') {
          return <br key={i} />
        }
        return part
      })
  }

  const handleExpand = () => {
    if (!isLoggedIn) {
      alert('Please sign in to chat with BullishAI')
      window.location.href = '/auth/signin'
      return
    }
    setIsExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className={`transition-all duration-500 ease-out ${
      isExpanded ? 'h-auto' : 'h-auto'
    }`}>
      {/* Collapsed State - Trigger Button */}
      {!isExpanded ? (
        <div
          onClick={handleExpand}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700 cursor-pointer hover:border-blue-500/50 transition group"
        >
          <div className="mb-4">
            <span className="text-sm font-semibold text-blue-400 uppercase tracking-wider">AI-Powered</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                readOnly
                placeholder={isLoggedIn ? "Ask anything about stocks..." : "Sign in to chat with BullishAI"}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg cursor-pointer"
              />
            </div>
            <button className="px-8 py-4 rounded-lg font-semibold transition bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 group-hover:scale-105">
              Ask AI →
            </button>
          </div>
        </div>
      ) : (
        /* Expanded State - Full Chat Interface */
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">BullishAI Market Analyst</h3>
                <p className="text-sm text-slate-400">Live market data at your fingertips</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-4 space-y-4 bg-slate-900/30">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                } animate-in fade-in slide-in-from-bottom-4`}
              >
                {message.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-lg ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ml-auto'
                        : 'bg-slate-800 text-white border border-slate-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{renderMarkdown(message.text)}</p>
                    {message.data && message.data.symbol && (
                      <div className="mt-3 flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                        <div>
                          <div className="font-bold text-lg">{message.data.symbol}</div>
                          <div className={`flex items-center gap-2 text-sm ${
                            message.data.changePct && message.data.changePct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {message.data.price && `$${message.data.price.toFixed(2)}`}
                            {message.data.changePct !== undefined && (
                              <>
                                {message.data.changePct >= 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span>{message.data.changePct >= 0 ? '+' : ''}{message.data.changePct.toFixed(2)}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 px-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      You
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 animate-in fade-in">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">BullishAI is analyzing market data...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 backdrop-blur">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isLoggedIn || isTyping}
                placeholder={!isLoggedIn ? "Sign in to chat..." : "Ask about stocks, trends, or investments..."}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || !isLoggedIn || isTyping}
                className="px-6 py-3 rounded-lg font-semibold transition bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

