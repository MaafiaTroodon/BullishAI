import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { checkPriceAlerts, sendDailySummary } from '@/inngest/functions/alerts'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkPriceAlerts,
    sendDailySummary,
  ],
})

