import { useCallback, useSyncExternalStore } from 'react'
import type { Movie } from '../data/movies'

/** A watchlist entry keeps enough of the item to render a card offline. */
export interface WatchlistEntry {
  id: string
  tmdbId?: number
  mediaType: 'movie' | 'tv'
  title: string
  year: number
  rating: number
  posterUrl?: string | null
  addedAt: number
}

const STORAGE_KEY = 'ronaljarvis.watchlist.v1'

function load(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is WatchlistEntry =>
        typeof e === 'object' && e !== null && typeof (e as WatchlistEntry).id === 'string',
    )
  } catch {
    return []
  }
}

/* -------------------------------------------------------------------------- */
/* One store, many readers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every poster card reads this list, and the header counts it — so it lives in
 * one module-level store rather than in per-component state. With per-component
 * copies each card would keep its own stale snapshot and the last one to write
 * would clobber the others in localStorage.
 */
let entries: WatchlistEntry[] = load()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  return entries
}

function commit(next: WatchlistEntry[]) {
  entries = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — the list just won't survive a reload */
  }
  for (const fn of listeners) fn()
}

// Another tab writing the list should reach this one too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    entries = load()
    for (const fn of listeners) fn()
  })
}

/**
 * "Später ansehen" list. Browser-local, like the reminder log — there is no
 * account behind this app to sync it to.
 */
export function useWatchlist() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const has = useCallback((id: string) => list.some((e) => e.id === id), [list])

  const toggle = useCallback((movie: Movie, mediaType: 'movie' | 'tv' = 'movie') => {
    if (entries.some((e) => e.id === movie.id)) {
      commit(entries.filter((e) => e.id !== movie.id))
      return
    }
    commit([
      ...entries,
      {
        id: movie.id,
        tmdbId: movie.tmdbId,
        mediaType,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        posterUrl: movie.posterUrl ?? null,
        addedAt: Date.now(),
      },
    ])
  }, [])

  const remove = useCallback((id: string) => {
    commit(entries.filter((e) => e.id !== id))
  }, [])

  const clear = useCallback(() => commit([]), [])

  return { entries: list, has, toggle, remove, clear }
}
