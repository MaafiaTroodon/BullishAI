const HOME_UNIVERSE_RAW = [
  'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META', 'NVDA', 'TSLA', 'BRK.B', 'JPM',
  'V', 'MA', 'UNH', 'XOM', 'CVX', 'PEP', 'KO', 'COST', 'WMT', 'HD',
  'PG', 'JNJ', 'ABBV', 'MRK', 'LLY', 'PFE', 'TMO', 'DHR', 'ABT', 'ACN',
  'ORCL', 'CRM', 'AVGO', 'QCOM', 'AMD', 'INTC', 'TXN', 'IBM', 'CSCO', 'ADBE',
  'NFLX', 'DIS', 'CMCSA', 'NKE', 'MCD', 'SBUX', 'LOW', 'PM', 'MO', 'CAT',
  'DE', 'GE', 'HON', 'LMT', 'RTX', 'BA', 'UPS', 'FDX', 'UNP', 'CSX',
  'NSC', 'SPGI', 'GS', 'MS', 'BAC', 'WFC', 'C', 'AXP', 'BK', 'SCHW',
  'BLK', 'USB', 'PNC', 'TFC', 'ICE', 'CME', 'KKR', 'BX', 'AIG', 'MET',
  'GILD', 'AMGN', 'BMY', 'MDT', 'SYK', 'ISRG', 'ZTS', 'CI', 'HUM', 'CVS',
  'ELV', 'VRTX', 'REGN', 'MU', 'AMAT', 'LRCX', 'KLAC', 'ASML', 'SNPS', 'CDNS',
  'NOW', 'INTU', 'ADP', 'TEAM', 'SNOW', 'UBER', 'ABNB', 'BKNG', 'MAR', 'HLT',
  'DAL', 'AAL', 'UAL', 'RCL', 'NCLH', 'CCL', 'GM', 'F', 'TSM', 'SHOP',
  'SQ', 'PYPL', 'COIN', 'SOFI', 'RBLX', 'EA', 'TTWO', 'ROKU', 'PLTR', 'DDOG',
  'CRWD', 'PANW', 'ZS', 'OKTA', 'NET', 'SNAP', 'PINS', 'TWLO',
  'COP', 'EOG', 'OXY', 'SLB', 'MPC', 'VLO', 'PSX', 'KMI', 'WMB', 'NEE',
  'DUK', 'SO', 'AEP', 'EXC', 'ED', 'SRE', 'D', 'FE', 'PPL', 'PLD',
  'AMT', 'EQIX', 'CCI', 'SPG', 'O', 'AVB', 'EQR', 'DLR', 'WELL', 'MMM',
  'LIN', 'APD', 'EMR', 'ETN', 'ITW', 'SHW', 'ROST', 'TGT',
]

export const HOME_UNIVERSE = Array.from(new Set(HOME_UNIVERSE_RAW))

export function getHomeUniverse(limit = 150) {
  return HOME_UNIVERSE.slice(0, limit)
}
