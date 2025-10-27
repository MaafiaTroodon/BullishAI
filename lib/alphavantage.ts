import axios from 'axios'

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY

export async function getQuote(symbol: string) {
  if (!ALPHAVANTAGE_API_KEY) return null

  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: ALPHAVANTAGE_API_KEY,
      },
    })

    if (response.data['Error Message']) {
      throw new Error('Invalid symbol')
    }

    const quote = response.data['Global Quote']
    if (!quote) return null

    return {
      c: parseFloat(quote['05. price']),
      d: parseFloat(quote['09. change']),
      dp: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
      h: parseFloat(quote['03. high']),
      l: parseFloat(quote['04. low']),
      o: parseFloat(quote['02. open']),
      pc: parseFloat(quote['08. previous close']),
      t: Date.now() / 1000,
    }
  } catch (error) {
    console.error('Alpha Vantage error:', error)
    throw error
  }
}

export async function getTimeSeries(symbol: string, interval = 'TIME_SERIES_INTRADAY') {
  if (!ALPHAVANTAGE_API_KEY) return null

  try {
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: interval,
        symbol,
        interval: '5min',
        apikey: ALPHAVANTAGE_API_KEY,
      },
    })

    const timeSeries = response.data['Time Series (5min)']
    if (!timeSeries) return null

    const chartData = []
    for (const [timestamp, values] of Object.entries(timeSeries)) {
      const data: any = values
      chartData.push({
        timestamp: new Date(timestamp).getTime(),
        close: parseFloat(data['4. close']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        open: parseFloat(data['1. open']),
        volume: parseFloat(data['5. volume']),
      })
    }

    return { data: chartData }
  } catch (error) {
    console.error('Alpha Vantage TS error:', error)
    return null
  }
}

