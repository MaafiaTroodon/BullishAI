'use client'

import { X } from 'lucide-react'

interface ExplanationDrawerProps {
  isOpen: boolean
  onClose: () => void
  explanation: string
  ticker: string
}

export function ExplanationDrawer({ isOpen, onClose, explanation, ticker }: ExplanationDrawerProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-slate-800 border-l border-slate-700 z-50 shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Explanation: {ticker}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded transition"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <p className="text-slate-300 leading-relaxed">
              {explanation}
            </p>
          </div>
          
          {/* Footer */}
          <div className="p-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Educational only — not financial advice.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

