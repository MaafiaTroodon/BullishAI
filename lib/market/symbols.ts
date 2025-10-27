export interface SymbolInfo {
  symbol: string
  aliases: string[]
  companyName: string
}

export const SYMBOL_MAP: Record<string, SymbolInfo> = {
  AAPL: {
    symbol: 'AAPL',
    aliases: ['apple', 'apple inc', 'apple inc.', 'apple corporation'],
    companyName: 'Apple Inc.',
  },
  AMZN: {
    symbol: 'AMZN',
    aliases: ['amazon', 'amazon.com', 'amazon inc', 'amazon.com inc'],
    companyName: 'Amazon.com Inc.',
  },
  NVDA: {
    symbol: 'NVDA',
    aliases: ['nvidia', 'nvidia corporation'],
    companyName: 'NVIDIA Corporation',
  },
  TSLA: {
    symbol: 'TSLA',
    aliases: ['tesla', 'tesla motors', 'tesla inc'],
    companyName: 'Tesla Inc.',
  },
  MSFT: {
    symbol: 'MSFT',
    aliases: ['microsoft', 'microsoft corporation', 'microsoft corp'],
    companyName: 'Microsoft Corporation',
  },
  GOOGL: {
    symbol: 'GOOGL',
    aliases: ['google', 'google class a', 'alphabet', 'alphabet class a'],
    companyName: 'Alphabet Inc.',
  },
  GOOG: {
    symbol: 'GOOG',
    aliases: ['google class c', 'alphabet class c'],
    companyName: 'Alphabet Inc. Class C',
  },
  META: {
    symbol: 'META',
    aliases: ['meta', 'meta platforms', 'facebook'],
    companyName: 'Meta Platforms Inc.',
  },
  NFLX: {
    symbol: 'NFLX',
    aliases: ['netflix', 'netflix inc'],
    companyName: 'Netflix Inc.',
  },
  INTC: {
    symbol: 'INTC',
    aliases: ['intel', 'intel corporation', 'intel corp'],
    companyName: 'Intel Corporation',
  },
  AMD: {
    symbol: 'AMD',
    aliases: ['amd', 'advanced micro devices'],
    companyName: 'Advanced Micro Devices',
  },
  JPM: {
    symbol: 'JPM',
    aliases: ['jpmorgan', 'jp morgan', 'jpmorgan chase'],
    companyName: 'JPMorgan Chase & Co.',
  },
  V: {
    symbol: 'V',
    aliases: ['visa'],
    companyName: 'Visa Inc.',
  },
  MA: {
    symbol: 'MA',
    aliases: ['mastercard'],
    companyName: 'Mastercard Inc.',
  },
  DIS: {
    symbol: 'DIS',
    aliases: ['disney', 'walt disney'],
    companyName: 'The Walt Disney Company',
  },
  NKE: {
    symbol: 'NKE',
    aliases: ['nike'],
    companyName: 'Nike Inc.',
  },
  WMT: {
    symbol: 'WMT',
    aliases: ['walmart', 'walmart inc'],
    companyName: 'Walmart Inc.',
  },
  VZ: {
    symbol: 'VZ',
    aliases: ['verizon'],
    companyName: 'Verizon Communications Inc.',
  },
}

/**
 * Normalize user input to a ticker symbol
 */
export function normalizeToSymbol(input: string): string | null {
  if (!input) return null

  const clean = input.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  // Check exact match
  if (SYMBOL_MAP[input.toUpperCase()]) {
    return input.toUpperCase()
  }

  // Check aliases
  for (const [symbol, info] of Object.entries(SYMBOL_MAP)) {
    if (info.aliases.some((alias) => alias.toLowerCase() === clean)) {
      return symbol
    }
    if (info.aliases.some((alias) => alias.toLowerCase().includes(clean) || clean.includes(alias.toLowerCase()))) {
      return symbol
    }
  }

  // If input looks like a ticker (1-5 uppercase letters)
  const tickerPattern = /^[A-Z]{1,5}$/
  if (tickerPattern.test(input.toUpperCase())) {
    return input.toUpperCase()
  }

  return null
}

/**
 * Coerce a query parameter to a ticker symbol
 */
export function coerceTicker(query: string | string[] | undefined): string | null {
  if (!query) return null
  const input = Array.isArray(query) ? query[0] : query
  return normalizeToSymbol(input)
}

/**
 * Get symbol info if exists
 */
export function getSymbolInfo(symbol: string): SymbolInfo | null {
  return SYMBOL_MAP[symbol.toUpperCase()] || null
}

