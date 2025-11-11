/**
 * Market Symbol Parser
 * Handles symbol normalization for NYSE, NASDAQ, and TSX
 */

export interface ParsedSymbol {
  symbol: string
  exchange: 'NYSE' | 'NASDAQ' | 'TSX' | 'UNKNOWN'
  currency: 'USD' | 'CAD'
  normalizedSymbol: string // For API calls
}

/**
 * Parse symbol and determine exchange
 * Handles formats like: AAPL, RY.TO, RY:TSX, etc.
 */
export function parseSymbol(symbolInput: string): ParsedSymbol {
  const symbol = symbolInput.toUpperCase().trim()
  
  // Handle TSX formats: RY.TO, RY:TSX, RY-TSX
  if (symbol.includes('.TO') || symbol.includes(':TSX') || symbol.includes('-TSX')) {
    const baseSymbol = symbol.replace(/\.TO|:TSX|-TSX/g, '')
    return {
      symbol: baseSymbol,
      exchange: 'TSX',
      currency: 'CAD',
      normalizedSymbol: `${baseSymbol}.TO`, // Yahoo Finance format
    }
  }
  
  // Handle NYSE/NASDAQ formats: AAPL:NYSE, MSFT:NASDAQ
  if (symbol.includes(':NYSE')) {
    const baseSymbol = symbol.replace(':NYSE', '')
    return {
      symbol: baseSymbol,
      exchange: 'NYSE',
      currency: 'USD',
      normalizedSymbol: baseSymbol,
    }
  }
  
  if (symbol.includes(':NASDAQ')) {
    const baseSymbol = symbol.replace(':NASDAQ', '')
    return {
      symbol: baseSymbol,
      exchange: 'NASDAQ',
      currency: 'USD',
      normalizedSymbol: baseSymbol,
    }
  }
  
  // Default: assume US market (NYSE/NASDAQ)
  // Common TSX stocks that might be confused
  const tsxStocks = ['RY', 'TD', 'BNS', 'BMO', 'CM', 'NA', 'ENB', 'TRP', 'CNQ', 'SU', 'CP', 'CNR']
  if (tsxStocks.includes(symbol)) {
    // Check if it's likely TSX (could be ambiguous)
    // For now, default to US unless explicitly marked
    return {
      symbol,
      exchange: 'NYSE', // Most common
      currency: 'USD',
      normalizedSymbol: symbol,
    }
  }
  
  return {
    symbol,
    exchange: 'NYSE', // Default assumption
    currency: 'USD',
    normalizedSymbol: symbol,
  }
}

/**
 * Normalize symbol for API calls
 */
export function normalizeSymbolForAPI(symbol: string, exchange?: 'NYSE' | 'NASDAQ' | 'TSX'): string {
  const parsed = parseSymbol(symbol)
  
  if (exchange === 'TSX' || parsed.exchange === 'TSX') {
    return parsed.normalizedSymbol // Already .TO format
  }
  
  return parsed.normalizedSymbol
}

/**
 * Get exchange from symbol
 */
export function getExchange(symbol: string): 'NYSE' | 'NASDAQ' | 'TSX' | 'UNKNOWN' {
  return parseSymbol(symbol).exchange
}

/**
 * Get currency from symbol
 */
export function getCurrency(symbol: string): 'USD' | 'CAD' {
  return parseSymbol(symbol).currency
}

