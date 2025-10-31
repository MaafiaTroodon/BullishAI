export function normalizeTradingViewSymbol(raw: string): { exchange: string; tvSymbol: string } {
  const s = (raw || '').toUpperCase().trim()
  if (!s) return { exchange: 'NASDAQ', tvSymbol: 'NASDAQ:AAPL' }
  
  // If already has exchange prefix, use it
  if (s.includes(':')) {
    const [ex, sym] = s.split(':')
    return { exchange: ex, tvSymbol: s }
  }
  
  // Explicit maps for common cases
  const NASDAQ = new Set(['AAPL','MSFT','NVDA','GOOGL','GOOG','META','AMZN','TSLA','AMD','INTC','CSCO','NFLX','COIN','PLTR','SNOW','ZM','HOOD','DKNG'])
  const AMEX = new Set(['SPY','QQQ','VOO','IWM','DIA','TLT','GLD','SLV','UVXY','TQQQ','SQQQ'])
  const NYSE = new Set(['TSM','BABA','TM','NIO','XOM','CVX','KO','PEP','DIS','BA','GE','IBM','WMT','JPM','BAC','V','MA','GS','MS','BRK.B','BRK.A','CAT','DE','F','GM','HD','LOW','MCD','NKE','PG','UNH','WFC','X','CRM','ORCL','ADBE','INTC'])

  let exchange = 'NASDAQ'
  if (AMEX.has(s)) {
    exchange = 'AMEX'
  } else if (NYSE.has(s) || s.includes('.')) {
    exchange = 'NYSE'
  } else if (NASDAQ.has(s)) {
    exchange = 'NASDAQ'
  } else {
    // Default: try NASDAQ first, but widgets can handle auto-detection
    // TradingView will auto-detect the exchange for most US symbols
    exchange = 'NASDAQ'
  }

  return { exchange, tvSymbol: `${exchange}:${s}` }
}


