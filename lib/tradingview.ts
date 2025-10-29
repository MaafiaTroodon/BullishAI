export function normalizeTradingViewSymbol(raw: string): { exchange: string; tvSymbol: string } {
  const s = (raw || '').toUpperCase().trim()
  if (!s) return { exchange: 'NASDAQ', tvSymbol: 'NASDAQ:AAPL' }
  if (s.includes(':')) {
    const [ex] = s.split(':')
    return { exchange: ex, tvSymbol: s }
  }
  // Explicit maps for common cases
  const NASDAQ = new Set(['AAPL','MSFT','NVDA','GOOGL','GOOG','META','AMZN','TSLA','AMD','INTC','CSCO','NFLX'])
  const AMEX = new Set(['SPY','QQQ','VOO','IWM','DIA'])
  const NYSE = new Set(['TSM','BABA','TM','NIO','XOM','CVX','KO','PEP','DIS','BA','GE','IBM','WMT','JPM','BAC','V','MA','GS','MS','BRK.B','BRK.A'])

  let exchange = 'NASDAQ'
  if (AMEX.has(s)) exchange = 'AMEX'
  else if (NYSE.has(s) || s.includes('.')) exchange = 'NYSE'
  else if (NASDAQ.has(s)) exchange = 'NASDAQ'

  return { exchange, tvSymbol: `${exchange}:${s}` }
}


