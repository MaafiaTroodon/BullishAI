'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  actionLabel?: string
  actionHref?: string
}

let toastListeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []

function notify() {
  toastListeners.forEach(listener => listener([...toasts]))
}

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = Math.random().toString(36).substring(7)
  const toast: Toast = { id, message, type, duration }
  toasts.push(toast)
  notify()

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

export function showToastWithAction(
  message: string,
  type: ToastType,
  actionLabel: string,
  actionHref: string,
  duration = 6000
) {
  const id = Math.random().toString(36).substring(7)
  const toast: Toast = { id, message, type, duration, actionLabel, actionHref }
  toasts.push(toast)
  notify()

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

export function ToastContainer() {
  const [state, setState] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setState(newToasts)
    toastListeners.push(listener)
    setState([...toasts])
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener)
    }
  }, [])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }

  const colors = {
    success: 'bg-emerald-500 border-emerald-400',
    error: 'bg-red-500 border-red-400',
    info: 'bg-blue-500 border-blue-400',
    warning: 'bg-yellow-500 border-yellow-400',
  }

  return (
    <div className="fixed top-20 right-4 z-[100] space-y-2 pointer-events-none">
      {state.map(toast => {
        const Icon = icons[toast.type]
        const colorClasses = colors[toast.type]
        return (
          <div
            key={toast.id}
            className={`${colorClasses} border rounded-lg shadow-lg px-4 py-3 min-w-[300px] max-w-[400px] flex items-start gap-3 pointer-events-auto animate-in slide-in-from-right-full fade-in`}
          >
            <Icon className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{toast.message}</p>
              {toast.actionLabel && toast.actionHref && (
                <button
                  onClick={() => {
                    removeToast(toast.id)
                    window.location.href = toast.actionHref as string
                  }}
                  className="mt-2 text-white text-xs font-semibold underline underline-offset-2"
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
