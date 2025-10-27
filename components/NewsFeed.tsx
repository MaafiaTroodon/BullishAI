'use client'

import { Clock, ExternalLink } from 'lucide-react'

interface NewsArticle {
  headline: string
  summary: string
  source: string
  url: string
  image: string
  datetime: number
}

interface NewsFeedProps {
  news?: NewsArticle[]
  initialNews?: any[]
  symbol: string
}

export function NewsFeed({ news, initialNews, symbol }: NewsFeedProps) {
  const displayNews = news || initialNews || []
  if (!displayNews || displayNews.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-xl font-semibold text-white mb-4">Latest News for {symbol}</h3>
        <p className="text-slate-400">No news available at the moment</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h3 className="text-xl font-semibold text-white mb-4">Latest News for {symbol}</h3>
      <div className="space-y-4">
        {displayNews.map((article, index) => (
          <a
            key={index}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition border border-slate-600 hover:border-blue-500"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-white hover:text-blue-400 transition">
                {article.headline}
              </h4>
              <ExternalLink className="h-4 w-4 text-slate-400 ml-2 flex-shrink-0" />
            </div>
            {article.summary && (
              <p className="text-sm text-slate-300 mb-2 line-clamp-2">
                {article.summary}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-medium">{article.source}</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(article.datetime * 1000).toLocaleDateString()}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

