'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Sparkles } from 'lucide-react'
import { explain, ScreenRow, ScreenType } from '@/lib/screens/explanations'
import { ExplanationDrawer } from './ExplanationDrawer'

interface Column {
  key: string
  label: string
  sortable: boolean
  format?: (value: any) => string
}

interface ScreenTableProps {
  title: string
  columns: Column[]
  data: ScreenRow[]
  screenType: ScreenType
  apiEndpoint: string
  onRefresh?: () => void
}

export function ScreenTable({ title, columns, data, screenType, apiEndpoint, onRefresh }: ScreenTableProps) {
  const [sortKey, setSortKey] = useState<string>(columns.find(c => c.key.includes('score'))?.key || columns[0].key)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedRow, setSelectedRow] = useState<ScreenRow | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey]
      const bVal = (b as any)[sortKey]
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
    return sorted
  }, [data, sortKey, sortDirection])

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const handleExplain = (row: ScreenRow) => {
    setSelectedRow(row)
    setIsDrawerOpen(true)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      if (onRefresh) {
        await onRefresh()
      }
      setTimeout(() => setIsRefreshing(false), 500)
    } catch (error) {
      setIsRefreshing(false)
    }
  }

  const getSortIcon = (key: string) => {
    if (key !== sortKey) return null
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />
  }

  return (
    <>
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">Data: mock</span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => col.sortable && handleSort(col.key)}
                        className={`px-6 py-4 text-left text-sm font-semibold text-slate-300 ${
                          col.sortable ? 'cursor-pointer hover:bg-slate-700 transition' : ''
                        }`}
                      >
                        <div className="flex items-center">
                          {col.label}
                          {col.sortable && getSortIcon(col.key)}
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Chart
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sortedData.map((row, idx) => (
                    <tr key={`${(row as any).ticker}-${idx}`} className="hover:bg-slate-800/50 transition">
                      {columns.map((col) => {
                        const value = (row as any)[col.key]
                        const displayValue = col.format ? col.format(value) : value
                        return (
                          <td key={col.key} className="px-6 py-4 text-sm text-slate-300">
                            {displayValue}
                          </td>
                        )
                      })}
                      <td className="px-6 py-4">
                        <div className="w-16 h-8 bg-slate-700 rounded flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-slate-500" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleExplain(row)}
                          className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition text-sm font-semibold"
                        >
                          Explain
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Banner */}
          <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
            <p className="text-yellow-400 text-sm text-center">
              Educational only — not financial advice.
            </p>
          </div>
        </div>
      </div>

      {/* Explanation Drawer */}
      <ExplanationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        explanation={selectedRow ? explain(selectedRow, screenType) : ''}
        ticker={selectedRow ? (selectedRow as any).ticker : ''}
      />
    </>
  )
}

