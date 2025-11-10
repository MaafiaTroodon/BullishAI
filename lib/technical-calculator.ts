/**
 * Deterministic Technical Calculator
 * Computes technical indicators from OHLCV data - no LLM for numbers
 */

export interface TechnicalCalcResult {
  trend: 'BULLISH' | 'BEARISH' | 'RANGE'
  support: number | null
  resistance: number | null
  momentum_score: number | null
  patterns: string[]
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  
  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }
  
  const gains = changes.filter(c => c > 0)
  const losses = changes.filter(c => c < 0)
  
  if (gains.length === 0 && losses.length === 0) return 50
  
  const avgGain = gains.length > 0 
    ? gains.slice(-period).reduce((a, b) => a + b, 0) / Math.min(gains.length, period)
    : 0
  const avgLoss = losses.length > 0
    ? Math.abs(losses.slice(-period).reduce((a, b) => a + b, 0)) / Math.min(losses.length, period)
    : 0
  
  if (avgLoss === 0) return 100
  
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

/**
 * Calculate trend from moving averages
 */
export function calculateTrend(prices: number[]): 'BULLISH' | 'BEARISH' | 'RANGE' {
  if (prices.length < 50) return 'RANGE'
  
  const ma20 = calculateSMA(prices, 20)
  const ma50 = calculateSMA(prices, 50)
  
  if (ma20 > ma50) return 'BULLISH'
  if (ma20 < ma50) return 'BEARISH'
  return 'RANGE'
}

/**
 * Find support level (last local minimum in last 20 bars)
 */
export function findSupport(ohlc: Array<{ low: number }>, lookback = 20): number | null {
  if (ohlc.length < 5) return null
  
  const recent = ohlc.slice(-lookback)
  let minLow = Infinity
  let minIndex = -1
  
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i + 1].low) {
      if (recent[i].low < minLow) {
        minLow = recent[i].low
        minIndex = i
      }
    }
  }
  
  // If no local minimum found, use absolute minimum
  if (minIndex === -1) {
    minLow = Math.min(...recent.map(c => c.low))
  }
  
  return minLow !== Infinity ? minLow : null
}

/**
 * Find resistance level (last local maximum in last 20 bars)
 */
export function findResistance(ohlc: Array<{ high: number }>, lookback = 20): number | null {
  if (ohlc.length < 5) return null
  
  const recent = ohlc.slice(-lookback)
  let maxHigh = -Infinity
  let maxIndex = -1
  
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i + 1].high) {
      if (recent[i].high > maxHigh) {
        maxHigh = recent[i].high
        maxIndex = i
      }
    }
  }
  
  // If no local maximum found, use absolute maximum
  if (maxIndex === -1) {
    maxHigh = Math.max(...recent.map(c => c.high))
  }
  
  return maxHigh !== -Infinity ? maxHigh : null
}

/**
 * Calculate momentum score (0-100) from multiple factors
 */
export function calculateMomentumScore(
  prices: number[],
  volumes: number[],
  rsi: number
): number | null {
  if (prices.length < 5 || volumes.length < 5) return null
  
  // 5-day return
  const return5d = prices.length >= 5
    ? ((prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5]) * 100
    : 0
  
  // Volume vs 20-day average
  const avgVolume20 = volumes.length >= 20
    ? calculateSMA(volumes, 20)
    : volumes[volumes.length - 1] || 1
  const volumeRatio = volumes.length > 0
    ? volumes[volumes.length - 1] / avgVolume20
    : 1
  
  // Normalize to Z-scores (simplified)
  const zRet = return5d / 10 // Normalize to roughly -3 to +3
  const zRSI = (rsi - 50) / 20 // Normalize RSI (0-100) to roughly -2.5 to +2.5
  const zVol = (volumeRatio - 1) * 2 // Normalize volume ratio
  
  // Weighted combination
  const combined = 0.45 * zRet + 0.35 * zRSI + 0.20 * zVol
  
  // Sigmoid to map to 0-100
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
  const score = sigmoid(combined) * 100
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Detect patterns from OHLC data
 */
export function detectPatterns(ohlc: Array<{ high: number; low: number; close: number }>): string[] {
  if (ohlc.length < 5) return []
  
  const patterns: string[] = []
  const recent = ohlc.slice(-10)
  
  // Check for Up Channel (higher highs and higher lows)
  let higherHighs = true
  let higherLows = true
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high <= recent[i - 1].high) higherHighs = false
    if (recent[i].low <= recent[i - 1].low) higherLows = false
  }
  if (higherHighs && higherLows) {
    patterns.push('Up Channel')
  }
  
  // Check for Triangle (compressing: lower highs, higher lows)
  let lowerHighs = true
  let higherLowsTriangle = true
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high >= recent[i - 1].high) lowerHighs = false
    if (recent[i].low <= recent[i - 1].low) higherLowsTriangle = false
  }
  if (lowerHighs && higherLowsTriangle) {
    patterns.push('Triangle')
  }
  
  // Check for Flag (3-5 bar pullback in uptrend)
  if (recent.length >= 5) {
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
    const secondHalf = recent.slice(Math.floor(recent.length / 2))
    
    const firstTrend = firstHalf[firstHalf.length - 1].close > firstHalf[0].close
    const secondTrend = secondHalf[secondHalf.length - 1].close < secondHalf[0].close
    
    if (firstTrend && secondTrend && secondHalf.length >= 3 && secondHalf.length <= 5) {
      patterns.push('Flag')
    }
  }
  
  return patterns
}

/**
 * Main technical calculator function
 */
export function calculateTechnical(
  ohlc: Array<{ open: number; high: number; low: number; close: number; volume: number }>,
  currentPrice: number
): TechnicalCalcResult {
  if (!ohlc || ohlc.length === 0) {
    return {
      trend: 'RANGE',
      support: null,
      resistance: null,
      momentum_score: null,
      patterns: [],
    }
  }
  
  // Filter out invalid data
  const validOhlc = ohlc.filter(c => 
    c.close > 0 && 
    c.high >= c.low && 
    c.high >= c.close && 
    c.low <= c.close
  )
  
  if (validOhlc.length < 5) {
    return {
      trend: 'RANGE',
      support: null,
      resistance: null,
      momentum_score: null,
      patterns: [],
    }
  }
  
  const prices = validOhlc.map(c => c.close)
  const volumes = validOhlc.map(c => c.volume || 0)
  
  // Calculate indicators
  const trend = calculateTrend(prices)
  const support = findSupport(validOhlc.map(c => ({ low: c.low })))
  const resistance = findResistance(validOhlc.map(c => ({ high: c.high })))
  const rsi = calculateRSI(prices)
  const momentum_score = calculateMomentumScore(prices, volumes, rsi)
  const patterns = detectPatterns(validOhlc.map(c => ({ high: c.high, low: c.low, close: c.close })))
  
  return {
    trend,
    support,
    resistance,
    momentum_score,
    patterns,
  }
}

