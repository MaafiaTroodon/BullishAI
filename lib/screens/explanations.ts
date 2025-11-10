/**
 * Explanation Generator
 * Provides one-line explanations for screen rows
 */

import { EXPLANATION_PROVIDER } from './config'

export interface MomentumRow {
  ticker: string
  price: number
  ret_5d: number
  rsi_14: number
  vol_surge_x: number
  score: number
}

export interface ReboundRow {
  ticker: string
  price: number
  ytd_return: number
  ret_10d: number
  recovery_score: number
}

export interface TodayRow {
  ticker: string
  price: number
  intraday_change: number
  vol_vs_avg_x: number
  today_score: number
}

export interface StableRow {
  ticker: string
  price: number
  beta: number
  eps_cagr_5y: number
  stability_score: number
}

export type ScreenRow = MomentumRow | ReboundRow | TodayRow | StableRow
export type ScreenType = 'momentum' | 'rebound' | 'today' | 'stable'

export function explain(record: ScreenRow, screen: ScreenType): string {
  if (EXPLANATION_PROVIDER === 'mock') {
    return generateMockExplanation(record, screen)
  }
  
  // Future: Add Groq/Gemini calls here
  return generateMockExplanation(record, screen)
}

function generateMockExplanation(record: ScreenRow, screen: ScreenType): string {
  switch (screen) {
    case 'momentum': {
      const r = record as MomentumRow
      return `${r.ticker} shows ${r.ret_5d.toFixed(2)}% in 5D, RSI ${r.rsi_14.toFixed(1)}, and ${r.vol_surge_x.toFixed(1)}× volume, ranking high on short-term momentum (score ${r.score.toFixed(2)}).`
    }
    case 'rebound': {
      const r = record as ReboundRow
      return `${r.ticker} is negative YTD (${r.ytd_return.toFixed(2)}%), but improving over 10D (+${r.ret_10d.toFixed(2)}%) with trend confirmation, yielding a recovery score ${r.recovery_score.toFixed(2)}.`
    }
    case 'today': {
      const r = record as TodayRow
      return `${r.ticker} leads intraday at ${r.intraday_change >= 0 ? '+' : ''}${r.intraday_change.toFixed(2)}% with ${r.vol_vs_avg_x.toFixed(1)}× volume vs avg (score ${r.today_score.toFixed(2)}).`
    }
    case 'stable': {
      const r = record as StableRow
      return `${r.ticker} pairs low beta (${r.beta.toFixed(2)}) with ${r.eps_cagr_5y.toFixed(1)}% 5Y EPS CAGR (stability score ${r.stability_score.toFixed(2)}).`
    }
    default:
      return 'No explanation available.'
  }
}

