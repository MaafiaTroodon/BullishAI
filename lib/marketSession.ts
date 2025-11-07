/**
 * Market session utilities for US stock market (NYSE/Nasdaq)
 * All times in America/New_York timezone
 */

export type MarketSession = 'PRE' | 'REG' | 'POST' | 'CLOSED'

export interface MarketSessionInfo {
  session: MarketSession
  label: string
  color: string
  description?: string
}

/**
 * Get current market session in ET
 */
export function getMarketSession(): MarketSessionInfo {
  const now = new Date()
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = etDate.getDay() // 0 = Sunday, 6 = Saturday
  const hours = etDate.getHours()
  const minutes = etDate.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  // Weekend or outside trading hours
  if (day === 0 || day === 6) {
    return {
      session: 'CLOSED',
      label: 'CLOSED',
      color: 'gray',
      description: 'Market is closed (weekend)'
    }
  }

  // Pre-market: 4:00 AM - 9:30 AM ET
  if (timeInMinutes >= 4 * 60 && timeInMinutes < 9 * 60 + 30) {
    return {
      session: 'PRE',
      label: 'PRE',
      color: 'amber',
      description: 'US pre-market trading'
    }
  }

  // Regular: 9:30 AM - 4:00 PM ET
  if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60) {
    return {
      session: 'REG',
      label: 'REG',
      color: 'green',
      description: 'US regular trading hours'
    }
  }

  // After-hours: 4:00 PM - 8:00 PM ET
  if (timeInMinutes >= 16 * 60 && timeInMinutes < 20 * 60) {
    return {
      session: 'POST',
      label: 'POST',
      color: 'blue',
      description: 'US post-market trading ends at 8:00 pm ET'
    }
  }

  // Closed: 8:00 PM - 4:00 AM ET
  return {
    session: 'CLOSED',
    label: 'CLOSED',
    color: 'gray',
    description: 'Market is closed'
  }
}

/**
 * Get refresh interval based on market session
 */
export function getRefreshInterval(session: MarketSession): number {
  switch (session) {
    case 'PRE':
    case 'REG':
    case 'POST':
      return 15000 // 15 seconds during active trading
    case 'CLOSED':
      return 60000 // 60 seconds when closed
  }
}

/**
 * Format ET time for display
 */
export function formatETTime(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) + ' ET'
}

