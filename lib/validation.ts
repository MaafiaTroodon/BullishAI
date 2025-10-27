import { z } from 'zod'

export const quoteSchema = z.object({
  ticker: z.string().min(1).max(10),
})

export const newsSchema = z.object({
  ticker: z.string().min(1).max(10),
  limit: z.string().optional().transform((val) => {
    if (!val) return 5
    const num = parseInt(val, 10)
    if (isNaN(num) || num < 1) return 5
    return Math.min(num, 20)
  }),
})

export const fundamentalsSchema = z.object({
  ticker: z.string().min(1).max(10),
})

