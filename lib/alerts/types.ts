import { z } from 'zod'
import { db } from '@/lib/db'

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

// Database-backed alert functions
export async function listAlerts(userId: string): Promise<Alert[]> {
  try {
    const alerts = await db.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    
    // Convert DB format to API format
    return alerts.map(alert => ({
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type as Alert['type'],
      value: alert.value,
      active: alert.active,
      createdAt: alert.createdAt.getTime(),
      notes: undefined, // Notes field doesn't exist in DB schema yet
    }))
  } catch (error: any) {
    console.error('Error listing alerts from DB:', error)
    return []
  }
}

export async function createAlert(userId: string, input: CreateAlertInput): Promise<Alert> {
  try {
    const alert = await db.alert.create({
      data: {
        userId,
        symbol: input.symbol.toUpperCase(),
        type: input.type,
        value: input.value,
        active: true,
        notified: false,
      },
    })
    
    return {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type as Alert['type'],
      value: alert.value,
      active: alert.active,
      createdAt: alert.createdAt.getTime(),
      notes: input.notes,
    }
  } catch (error: any) {
    console.error('Error creating alert in DB:', error)
    throw new Error(`Failed to create alert: ${error.message}`)
  }
}

export async function getAlert(userId: string, id: string): Promise<Alert | undefined> {
  try {
    const alert = await db.alert.findFirst({
      where: { id, userId },
    })
    
    if (!alert) return undefined
    
    return {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type as Alert['type'],
      value: alert.value,
      active: alert.active,
      createdAt: alert.createdAt.getTime(),
      notes: undefined,
    }
  } catch (error: any) {
    console.error('Error getting alert from DB:', error)
    return undefined
  }
}

export async function updateAlert(userId: string, id: string, patch: Partial<Alert>): Promise<Alert | undefined> {
  try {
    const updateData: any = {}
    if (patch.active !== undefined) updateData.active = patch.active
    if (patch.symbol !== undefined) updateData.symbol = patch.symbol.toUpperCase()
    if (patch.type !== undefined) updateData.type = patch.type
    if (patch.value !== undefined) updateData.value = patch.value
    
    const alert = await db.alert.update({
      where: { id, userId },
      data: updateData,
    })
    
    return {
      id: alert.id,
      symbol: alert.symbol,
      type: alert.type as Alert['type'],
      value: alert.value,
      active: alert.active,
      createdAt: alert.createdAt.getTime(),
      notes: undefined,
    }
  } catch (error: any) {
    console.error('Error updating alert in DB:', error)
    return undefined
  }
}

export async function deleteAlert(userId: string, id: string): Promise<boolean> {
  try {
    await db.alert.delete({
      where: { id, userId },
    })
    return true
  } catch (error: any) {
    console.error('Error deleting alert from DB:', error)
    return false
  }
}


