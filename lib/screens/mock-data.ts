/**
 * Mock Data Generator
 * Deterministic seeded data for all screens
 */

import { MomentumRow, ReboundRow, TodayRow, StableRow } from './explanations'

// Well-known tickers seed
const TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'JPM', 'V', 'JNJ', 'PG', 'MA', 'DIS', 'BAC']

// Deterministic seed function
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function zScore(value: number, mean: number, std: number): number {
  return (value - mean) / std
}

// Strongest Momentum Mock Data
export function generateMomentumData(): MomentumRow[] {
  const items: MomentumRow[] = []
  
  TICKERS.forEach((ticker, idx) => {
    const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx
    
    const ret_5d = -5 + seededRandom(seed) * 15 // -5% to +10%
    const rsi_14 = 30 + seededRandom(seed * 2) * 40 // 30 to 70
    const vol_surge_x = 1.0 + seededRandom(seed * 3) * 3.0 // 1.0x to 4.0x
    const price = 50 + seededRandom(seed * 4) * 450 // $50 to $500
    
    // Calculate z-scores
    const meanRet = 2.5
    const stdRet = 5.0
    const meanRSI = 50
    const stdRSI = 15
    const meanVol = 2.0
    const stdVol = 1.0
    
    const zRet = zScore(ret_5d, meanRet, stdRet)
    const zRSI = zScore(rsi_14, meanRSI, stdRSI)
    const zVol = zScore(vol_surge_x, meanVol, stdVol)
    
    // Score: 0.45·z(ret_5d) + 0.35·z(RSI14) + 0.20·z(vol_surge)
    const score = 0.45 * zRet + 0.35 * zRSI + 0.20 * zVol
    
    items.push({
      ticker,
      price: Math.round(price * 100) / 100,
      ret_5d: Math.round(ret_5d * 100) / 100,
      rsi_14: Math.round(rsi_14 * 10) / 10,
      vol_surge_x: Math.round(vol_surge_x * 10) / 10,
      score: Math.round(score * 100) / 100,
    })
  })
  
  return items.sort((a, b) => b.score - a.score)
}

// Undervalued Rebound Mock Data
export function generateReboundData(): ReboundRow[] {
  const items: ReboundRow[] = []
  
  TICKERS.forEach((ticker, idx) => {
    const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx
    
    const ytd_return = -25 + seededRandom(seed) * 10 // -25% to -15%
    const ret_10d = -2 + seededRandom(seed * 2) * 8 // -2% to +6%
    const price = 50 + seededRandom(seed * 3) * 450
    
    // Filter: ytd_return < 0 AND ret_10d > 0 AND MA20 > MA50 (simplified: ret_10d > 0)
    if (ret_10d > 0) {
      // Calculate z-scores
      const meanRet10d = 2.0
      const stdRet10d = 3.0
      const meanYtd = -20
      const stdYtd = 5.0
      
      const zRet10d = zScore(ret_10d, meanRet10d, stdRet10d)
      const zYtd = zScore(ytd_return, meanYtd, stdYtd)
      
      // recovery_score: z(ret_10d) - z(ytd_return)
      const recovery_score = zRet10d - zYtd
      
      items.push({
        ticker,
        price: Math.round(price * 100) / 100,
        ytd_return: Math.round(ytd_return * 100) / 100,
        ret_10d: Math.round(ret_10d * 100) / 100,
        recovery_score: Math.round(recovery_score * 100) / 100,
      })
    }
  })
  
  return items.sort((a, b) => b.recovery_score - a.recovery_score)
}

// Strongest Today Mock Data
export function generateTodayData(): TodayRow[] {
  const items: TodayRow[] = []
  
  TICKERS.forEach((ticker, idx) => {
    const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx
    
    const intraday_change = -3 + seededRandom(seed) * 8 // -3% to +5%
    const vol_vs_avg_x = 1.0 + seededRandom(seed * 2) * 4.0 // 1.0x to 5.0x
    const price = 50 + seededRandom(seed * 3) * 450
    
    // Calculate z-scores
    const meanIntraday = 1.0
    const stdIntraday = 2.5
    const meanVol = 2.5
    const stdVol = 1.5
    
    const zIntraday = zScore(intraday_change, meanIntraday, stdIntraday)
    const zVol = zScore(vol_vs_avg_x, meanVol, stdVol)
    
    // Score: 0.6·z(intraday_change) + 0.4·z(vol_vs_avg)
    const today_score = 0.6 * zIntraday + 0.4 * zVol
    
    items.push({
      ticker,
      price: Math.round(price * 100) / 100,
      intraday_change: Math.round(intraday_change * 100) / 100,
      vol_vs_avg_x: Math.round(vol_vs_avg_x * 10) / 10,
      today_score: Math.round(today_score * 100) / 100,
    })
  })
  
  return items.sort((a, b) => b.today_score - a.today_score)
}

// Stable Growth Picks Mock Data
export function generateStableData(): StableRow[] {
  const items: StableRow[] = []
  
  TICKERS.forEach((ticker, idx) => {
    const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + idx
    
    const beta = 0.3 + seededRandom(seed) * 0.6 // 0.3 to 0.9
    const eps_cagr_5y = 5 + seededRandom(seed * 2) * 15 // 5% to 20%
    const price = 50 + seededRandom(seed * 3) * 450
    
    // Filter: beta < 1.0 and consistent EPS growth (eps_cagr_5y > 0)
    if (beta < 1.0 && eps_cagr_5y > 0) {
      // Calculate z-scores
      const meanBeta = 0.6
      const stdBeta = 0.2
      const meanEPS = 12.5
      const stdEPS = 7.5
      
      const zBeta = zScore(beta, meanBeta, stdBeta)
      const zEPS = zScore(eps_cagr_5y, meanEPS, stdEPS)
      
      // stability_score: (1 - z(beta)) + z(eps_cagr_5y)
      const stability_score = (1 - zBeta) + zEPS
      
      items.push({
        ticker,
        price: Math.round(price * 100) / 100,
        beta: Math.round(beta * 100) / 100,
        eps_cagr_5y: Math.round(eps_cagr_5y * 10) / 10,
        stability_score: Math.round(stability_score * 100) / 100,
      })
    }
  })
  
  return items.sort((a, b) => b.stability_score - a.stability_score)
}

