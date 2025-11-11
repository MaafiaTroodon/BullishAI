/**
 * Dividend Processing Jobs
 * Runs daily to process dividends
 */

import { inngest } from '../client'
import { processDividendPayout } from '@/lib/dividend-processor'
import { pool } from '@/lib/db-sql'

/**
 * Daily job: Ingest corporate actions from dividend calendar
 * Runs at 00:05 ET
 */
export const ingestCorporateActions = inngest.createFunction(
  { id: 'ingest-corporate-actions' },
  { cron: '5 0 * * *' }, // 00:05 ET (adjust timezone as needed)
  async ({ step }) => {
    return await step.run('fetch-dividend-calendar', async () => {
      // Fetch dividend calendar for next 90 days
      const today = new Date()
      const future = new Date(today)
      future.setDate(future.getDate() + 90)
      
      const from = today.toISOString().split('T')[0]
      const to = future.toISOString().split('T')[0]

      try {
        const calendarRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/dividends?range=month`
        )
        const calendar = await calendarRes.json()

        if (!calendar.items || !Array.isArray(calendar.items)) {
          return { processed: 0 }
        }

        const client = await pool.connect()
        let processed = 0

        try {
          for (const item of calendar.items) {
            if (!item.symbol || !item.exDate || !item.amount) continue

            // Get or create security
            let securityRes = await client.query(
              'SELECT id FROM securities WHERE symbol = $1',
              [item.symbol.toUpperCase()]
            )

            let securityId: string
            if (securityRes.rows.length === 0) {
              const insertRes = await client.query(
                `INSERT INTO securities (symbol, name, exchange, currency, "dividendFreq", "ttmDividendPerShare", "nextExDate")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [
                  item.symbol.toUpperCase(),
                  item.company || item.name,
                  item.exchange || 'NYSE',
                  item.currency || 'USD',
                  item.frequency || 'QUARTERLY',
                  parseFloat(item.amount) * (item.frequency === 'QUARTERLY' ? 4 : item.frequency === 'MONTHLY' ? 12 : 1),
                  new Date(item.exDate),
                ]
              )
              securityId = insertRes.rows[0].id
            } else {
              securityId = securityRes.rows[0].id
              // Update next ex date
              await client.query(
                'UPDATE securities SET "nextExDate" = $1, "ttmDividendPerShare" = $2 WHERE id = $3',
                [new Date(item.exDate), parseFloat(item.amount) * 4, securityId]
              )
            }

            // Create or update corporate action
            const exDate = new Date(item.exDate)
            const recordDate = item.recordDate ? new Date(item.recordDate) : new Date(exDate.getTime() + 24 * 60 * 60 * 1000) // +1 day
            const payDate = item.payDate ? new Date(item.payDate) : null

            await client.query(
              `INSERT INTO corporate_actions 
               ("securityId", type, "exDate", "recordDate", "payDate", "amountPerShare", currency, status)
               VALUES ($1, 'CASH_DIVIDEND', $2, $3, $4, $5, $6, 'PENDING')
               ON CONFLICT DO NOTHING`,
              [
                securityId,
                exDate,
                recordDate,
                payDate,
                parseFloat(item.amount),
                item.currency || 'USD',
              ]
            )

            processed++
          }
        } finally {
          client.release()
        }

        return { processed }
      } catch (error: any) {
        console.error('Failed to ingest corporate actions:', error)
        return { processed: 0, error: error.message }
      }
    })
  }
)

/**
 * Daily job: Snapshot holdings for record date
 * Runs at 06:00 ET
 */
export const snapshotHoldingsForRecordDate = inngest.createFunction(
  { id: 'snapshot-holdings-record-date' },
  { cron: '0 6 * * *' }, // 06:00 ET
  async ({ step }) => {
    return await step.run('snapshot-holdings', async () => {
      const client = await pool.connect()
      try {
        // Get all corporate actions with record_date = today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const caRes = await client.query(
          `SELECT ca.id, ca."securityId", s.symbol
           FROM corporate_actions ca
           JOIN securities s ON ca."securityId" = s.id
           WHERE ca.type = 'CASH_DIVIDEND'
             AND ca.status = 'PENDING'
             AND DATE(ca."recordDate") = DATE($1)`,
          [today]
        )

        let snapshotted = 0

        for (const ca of caRes.rows) {
          // Get all portfolios with positions in this security
          const positionsRes = await client.query(
            `SELECT p."portfolioId", p."totalShares"
             FROM positions p
             JOIN portfolios pf ON p."portfolioId" = pf.id
             WHERE p.symbol = $1 AND p."totalShares" > 0`,
            [ca.symbol]
          )

          // Store qty_on_record (this is already in dividend_payouts when we create it)
          snapshotted += positionsRes.rows.length
        }

        return { snapshotted }
      } finally {
        client.release()
      }
    })
  }
)

/**
 * Daily job: Process dividend payouts
 * Runs at 08:00 ET
 */
export const processDividendPayouts = inngest.createFunction(
  { id: 'process-dividend-payouts' },
  { cron: '0 8 * * *' }, // 08:00 ET
  async ({ step }) => {
    return await step.run('process-payouts', async () => {
      const client = await pool.connect()
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Get all pending payouts for today
        const payoutsRes = await client.query(
          `SELECT dp.*, s.symbol, ca."amountPerShare", ca.currency, ca."exDate", ca."recordDate", ca."payDate", pf."userId"
           FROM dividend_payouts dp
           JOIN securities s ON dp."securityId" = s.id
           JOIN corporate_actions ca ON dp."corporateActionId" = ca.id
           JOIN portfolios pf ON dp."portfolioId" = pf.id
           WHERE dp.status = 'PENDING'
             AND DATE(ca."payDate") = DATE($1)`,
          [today]
        )

        let processed = 0

        for (const payout of payoutsRes.rows) {
          try {
            await processDividendPayout(
              payout.userId,
              payout.symbol,
              new Date(payout.exDate),
              new Date(payout.recordDate),
              new Date(payout.payDate),
              parseFloat(payout.amountPerShare),
              payout.currency
            )
            processed++
          } catch (error: any) {
            console.error(`Failed to process payout ${payout.id}:`, error)
          }
        }

        return { processed }
      } finally {
        client.release()
      }
    })
  }
)

