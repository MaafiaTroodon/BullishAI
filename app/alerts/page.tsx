'use client'

import { useState } from 'react'
import { Bell, Plus, Trash2, AlertCircle } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Price Alerts</h1>
            <p className="text-slate-400">Get notified when stocks hit your target prices</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="h-5 w-5" />
            Create Alert
          </button>
        </div>

        {/* Alerts List */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="h-16 w-16 text-slate-500 mb-4" />
            <p className="text-slate-400 text-lg mb-2">No alerts yet</p>
            <p className="text-slate-500 text-sm mb-6">Create your first price alert</p>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Create Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

