/**
 * Market session utilities for US stock market (NYSE/Nasdaq)
 * All times in America/New_York timezone
 */

export type MarketSession = 'PRE' | 'REG' | 'POST' | 'OVERNIGHT' | 'CLOSED'

export interface MarketSessionInfo {
  session: MarketSession
  label: string
  color: string
  icon: 'sunrise' | 'sun' | 'sunset' | 'moon' | 'closed'
  description?: string
  endsAt?: string // HH:MM ET format
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
      icon: 'closed',
      description: 'Market is closed (weekend)'
    }
  }

  // Pre-market: 4:00 AM - 9:30 AM ET
  if (timeInMinutes >= 4 * 60 && timeInMinutes < 9 * 60 + 30) {
    return {
      session: 'PRE',
      label: 'PRE',
      color: 'amber',
      icon: 'sunrise',
      description: 'US pre-market trading',
      endsAt: '9:30 AM'
    }
  }

  // Regular: 9:30 AM - 4:00 PM ET
  if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60) {
    return {
      session: 'REG',
      label: 'REG',
      color: 'green',
      icon: 'sun',
      description: 'US regular trading hours',
      endsAt: '4:00 PM'
    }
  }

  // After-hours: 4:00 PM - 8:00 PM ET
  if (timeInMinutes >= 16 * 60 && timeInMinutes < 20 * 60) {
    return {
      session: 'POST',
      label: 'POST',
      color: 'blue',
      icon: 'sunset',
      description: 'US post-market trading',
      endsAt: '8:00 PM'
    }
  }

  // Overnight: 8:00 PM - 4:00 AM ET
  if (timeInMinutes >= 20 * 60 || timeInMinutes < 4 * 60) {
    return {
      session: 'OVERNIGHT',
      label: 'OVERNIGHT',
      color: 'purple',
      icon: 'moon',
      description: 'Overnight trading',
      endsAt: '4:00 AM'
    }
  }

  // Closed: fallback (shouldn't reach here)
  return {
    session: 'CLOSED',
    label: 'CLOSED',
    color: 'gray',
    icon: 'closed',
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
    case 'OVERNIGHT':
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

/**
 * Calculate countdown to session end
 */
export function getSessionCountdown(endsAt?: string): string | null {
  if (!endsAt) return null
  
  const now = new Date()
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const [time, period] = endsAt.split(' ')
  const [hours, minutes] = time.split(':').map(Number)
  
  let endHour = hours
  if (period === 'PM' && hours !== 12) endHour += 12
  if (period === 'AM' && hours === 12) endHour = 0
  
  const endTime = new Date(etNow)
  endTime.setHours(endHour, minutes, 0, 0)
  
  // If end time is tomorrow
  if (endTime <= etNow) {
    endTime.setDate(endTime.getDate() + 1)
  }
  
  const diffMs = endTime.getTime() - etNow.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const hoursLeft = Math.floor(diffMins / 60)
  const minsLeft = diffMins % 60
  
  if (hoursLeft > 0) {
    return `${hoursLeft}h ${minsLeft}m`
  }
  return `${minsLeft}m`
}

