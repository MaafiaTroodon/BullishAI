import { inngest } from '../client'
import { db } from '@/lib/db'
import { getQuote as getFinnhubQuote } from '@/lib/finnhub'
import { getQuote as getTwelveDataQuote } from '@/lib/twelvedata'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const checkPriceAlerts = inngest.createFunction(
  {
    id: 'check-price-alerts',
    name: 'Check Price Alerts',
  },
  { cron: '*/1 * * * *' }, // Run every minute
  async ({ step }) => {
    const alerts = await step.run('fetch-active-alerts', async () => {
      return db.alert.findMany({
        where: {
          active: true,
          notified: false,
        },
        include: {
          user: true,
        },
      })
    })

    const results = await step.run('check-alerts', async () => {
      const results = []
      
      for (const alert of alerts) {
        try {
          let quote
          try {
            quote = await getFinnhubQuote(alert.symbol)
          } catch (error) {
            quote = await getTwelveDataQuote(alert.symbol)
          }

          if (!quote) continue

          const currentPrice = quote.c
          let shouldNotify = false
          let message = ''

          switch (alert.type) {
            case 'above':
              if (currentPrice >= alert.value) {
                shouldNotify = true
                message = `${alert.symbol} crossed above $${alert.value.toFixed(2)} (current: $${currentPrice.toFixed(2)})`
              }
              break
            case 'below':
              if (currentPrice <= alert.value) {
                shouldNotify = true
                message = `${alert.symbol} crossed below $${alert.value.toFixed(2)} (current: $${currentPrice.toFixed(2)})`
              }
              break
            case 'pct_move':
              const change = Math.abs(quote.dp || 0)
              if (change >= alert.value) {
                shouldNotify = true
                message = `${alert.symbol} moved ${quote.dp?.toFixed(2)}% (threshold: ${alert.value}%)`
              }
              break
          }

          if (shouldNotify) {
            results.push({ alert, message })
          }
        } catch (error) {
          console.error(`Error checking alert ${alert.id}:`, error)
        }
      }

      return results
    })

    await step.run('send-notifications', async () => {
      for (const { alert, message } of results) {
        try {
          await resend.emails.send({
            from: 'alerts@bullish-ai.com',
            to: alert.user.email,
            subject: `Alert: ${alert.symbol}`,
            html: `
              <h2>Price Alert Triggered</h2>
              <p>${message}</p>
              <p>Check your dashboard: ${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/dashboard</p>
            `,
          })

          await db.alert.update({
            where: { id: alert.id },
            data: { notified: true },
          })
        } catch (error) {
          console.error(`Error sending notification for alert ${alert.id}:`, error)
        }
      }
    })

    return { checked: alerts.length, triggered: results.length }
  }
)

export const sendDailySummary = inngest.createFunction(
  {
    id: 'send-daily-summary',
    name: 'Send Daily Summary',
  },
  { cron: '0 22 * * *' }, // Run at 22:00 UTC (daily)
  async ({ step }) => {
    const users = await step.run('fetch-users-with-watchlists', async () => {
      return db.user.findMany({
        include: {
          watchlists: {
            include: {
              items: true,
            },
          },
        },
      })
    })

    await step.run('send-summaries', async () => {
      for (const user of users) {
        if (!user.watchlists || user.watchlists.length === 0) continue

        const allSymbols = new Set<string>()
        for (const watchlist of user.watchlists) {
          for (const item of watchlist.items) {
            allSymbols.add(item.symbol)
          }
        }

        const symbols = Array.from(allSymbols).slice(0, 10) // Limit to 10 symbols
        const quotes = []

        for (const symbol of symbols) {
          try {
            let quote
            try {
              quote = await getFinnhubQuote(symbol)
            } catch (error) {
              quote = await getTwelveDataQuote(symbol)
            }
            if (quote) {
              quotes.push({ symbol, ...quote })
            }
          } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error)
          }
        }

        if (quotes.length === 0) continue

        // Sort by biggest moves
        const topMovers = quotes
          .filter(q => q.dp !== 0)
          .sort((a, b) => Math.abs(b.dp || 0) - Math.abs(a.dp || 0))
          .slice(0, 5)

        try {
          await resend.emails.send({
            from: 'summaries@bullish-ai.com',
            to: user.email,
            subject: 'Daily Market Summary',
            html: `
              <h2>Your Daily Market Summary</h2>
              <h3>Top Movers Today:</h3>
              <ul>
                ${topMovers.map(q => `
                  <li><strong>${q.symbol}</strong>: ${q.c.toFixed(2)} (${q.dp?.toFixed(2)}%)</li>
                `).join('')}
              </ul>
              <p><a href="${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/dashboard">View Dashboard</a></p>
            `,
          })
        } catch (error) {
          console.error(`Error sending daily summary to ${user.email}:`, error)
        }
      }
    })

    return { sent: users.length }
  }
)

