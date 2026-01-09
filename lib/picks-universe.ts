import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { ensurePortfolioLoaded, listPositions } from '@/lib/portfolio'
import { DEFAULT_UNIVERSE } from '@/lib/universe'

export async function buildDefaultUniverse(origin: string): Promise<string[]> {
  const universe = new Set<string>()
  const session = await getSession()
  const userId = session?.user?.id || null

  if (userId) {
    try {
      await ensurePortfolioLoaded(userId)
      listPositions(userId).forEach((p) => universe.add(String(p.symbol || '').toUpperCase()))
    } catch {}
    try {
      const watchlistItems = await db.watchlistItem.findMany({
        where: { watchlist: { userId } },
        select: { symbol: true },
      })
      watchlistItems.forEach((item) => universe.add(String(item.symbol || '').toUpperCase()))
    } catch {}
  }

  try {
    const popularRes = await fetch(`${origin}/api/popular-stocks`, { cache: 'no-store' })
    const popular = await popularRes.json().catch(() => ({ stocks: [] }))
    ;(popular.stocks || []).forEach((s: any) => universe.add(String(s.symbol || s).toUpperCase()))
  } catch {}

  DEFAULT_UNIVERSE.forEach((symbol) => universe.add(symbol.toUpperCase()))

  return Array.from(universe).filter(Boolean)
}
