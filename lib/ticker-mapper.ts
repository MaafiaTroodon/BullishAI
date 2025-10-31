// Map company names to ticker symbols
export const COMPANY_TO_TICKER: Record<string, string> = {
  'amazon': 'AMZN',
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'meta': 'META',
  'facebook': 'META',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'netflix': 'NFLX',
  'amd': 'AMD',
  'intel': 'INTC',
  'oracle': 'ORCL',
  'ibm': 'IBM',
  'salesforce': 'CRM',
  'paypal': 'PYPL',
  'adobe': 'ADBE',
  'shopify': 'SHOP',
  'uber': 'UBER',
  'lyft': 'LYFT',
  'airbnb': 'ABNB',
  'disney': 'DIS',
  'walmart': 'WMT',
  'costco': 'COST',
  'target': 'TGT',
  'nike': 'NKE',
  'starbucks': 'SBUX',
  'cocacola': 'KO',
  'pepsi': 'PEP',
  'mcdonalds': 'MCD',
  'jp morgan': 'JPM',
  'bank of america': 'BAC',
  'wells fargo': 'WFC',
  'citigroup': 'C',
  'goldman sachs': 'GS',
  'morgan stanley': 'MS',
  'visa': 'V',
  'mastercard': 'MA',
  'american express': 'AXP',
  'berkshire hathaway': 'BRK.A',
  'coinbase': 'COIN',
  'robinhood': 'HOOD',
  'zoom': 'ZM',
  'snowflake': 'SNOW',
  'palantir': 'PLTR',
  'openai': 'MSFT', // Parent company
}

export function resolveTicker(query: string): string {
  const lower = query.toLowerCase().trim()
  
  // Direct match in map
  if (COMPANY_TO_TICKER[lower]) {
    return COMPANY_TO_TICKER[lower]
  }
  
  // If already looks like a ticker (uppercase, 1-5 chars)
  if (/^[A-Z]{1,5}$/.test(query.trim())) {
    return query.trim().toUpperCase()
  }
  
  // Try to find partial matches
  const partial = Object.entries(COMPANY_TO_TICKER).find(([name]) => 
    name.includes(lower) || lower.includes(name)
  )
  
  if (partial) {
    return partial[1]
  }
  
  // Default: return uppercase as ticker
  return query.trim().toUpperCase()
}

