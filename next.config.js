/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Allow TradingView external scripts
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://s3.tradingview.com https://www.tradingview.com; frame-src https://s3.tradingview.com https://www.tradingview.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data:; connect-src 'self' https://s3.tradingview.com https://www.tradingview.com;",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

