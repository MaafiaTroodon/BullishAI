import axios from 'axios'

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY

export async function getQuote(symbol: string) {
  if (!TWELVEDATA_API_KEY) return null

  try {
    const response = await axios.get('https://api.twelvedata.com/price', {
      params: {
        symbol,
        apikey: TWELVEDATA_API_KEY,
      },
    })
    return {
      c: parseFloat(response.data.price),
      d: 0,
      dp: 0,
      h: 0,
      l: 0,
      o: 0,
      pc: 0,
      t: Date.now(),
    }
  } catch (error) {
    throw error
  }
}

export async function getTimeSeries(symbol: string, interval = '5min', outputsize = 100) {
  if (!TWELVEDATA_API_KEY) return null

  try {
    const response = await axios.get('https://api.twelvedata.com/time_series', {
      params: {
        symbol,
        interval,
        outputsize,
        apikey: TWELVEDATA_API_KEY,
        format: 'json',
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

