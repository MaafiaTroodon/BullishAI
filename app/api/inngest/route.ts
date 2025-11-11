import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { checkPriceAlerts, sendDailySummary } from '@/inngest/functions/alerts'
import { ingestCorporateActions, snapshotHoldingsForRecordDate, processDividendPayouts } from '@/inngest/functions/dividends'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkPriceAlerts,
    sendDailySummary,
    ingestCorporateActions,
    snapshotHoldingsForRecordDate,
    processDividendPayouts,
  ],
})

