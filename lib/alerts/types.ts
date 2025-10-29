import { z } from 'zod'

export const AlertTypeEnum = z.enum([
  'price_above',
  'price_below',
  'percent_up',
  'percent_down',
  'volume_above',
])

export const CreateAlertSchema = z.object({
  symbol: z.string().min(1),
  type: AlertTypeEnum,
  value: z.number(),
  notes: z.string().optional(),
})

export const AlertSchema = CreateAlertSchema.extend({
  id: z.string(),
  createdAt: z.number(),
  active: z.boolean().default(true),
})

export type Alert = z.infer<typeof AlertSchema>
export type CreateAlertInput = z.infer<typeof CreateAlertSchema>

// Simple in-memory store (replace with DB later)
const alertsStore: Record<string, Alert[]> = {}

export function listAlerts(userId: string): Alert[] {
  return alertsStore[userId] || []
}

export function createAlert(userId: string, input: CreateAlertInput): Alert {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const alert: Alert = {
    id,
    createdAt: Date.now(),
    active: true,
    ...input,
  }
  alertsStore[userId] = [alert, ...(alertsStore[userId] || [])]
  return alert
}

export function getAlert(userId: string, id: string): Alert | undefined {
  return (alertsStore[userId] || []).find(a => a.id === id)
}

export function updateAlert(userId: string, id: string, patch: Partial<Alert>): Alert | undefined {
  const list = alertsStore[userId] || []
  const idx = list.findIndex(a => a.id === id)
  if (idx === -1) return undefined
  const updated = { ...list[idx], ...patch }
  list[idx] = updated
  alertsStore[userId] = list
  return updated
}

export function deleteAlert(userId: string, id: string): boolean {
  const list = alertsStore[userId] || []
  const next = list.filter(a => a.id !== id)
  alertsStore[userId] = next
  return next.length !== list.length
}


