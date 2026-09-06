import { useCallback, useSyncExternalStore } from 'react'

/**
 * The ALI DATABASE record.
 *
 * Some of a profile is live (mission phase, watchlist size, open reminders) —
 * that comes from the modules. The rest is Ali's own tally, which no module
 * can know, so it is editable and kept in this browser.
 */
export interface Profile {
  callsign: string
  home: string
  club: string
  currentGame: string
  nextDestination: string
  moviesWatched: number
  seriesWatched: number
  bjkMatches: number
  trips: number
}

const STORAGE_KEY = 'ronaljarvis.profile.v1'

export const DEFAULT_PROFILE: Profile = {
  callsign: 'ALI',
  home: 'GERMANY',
  club: 'BEŞIKTAŞ JK',
  currentGame: 'FORTNITE',
  nextDestination: 'MARMARIS',
  moviesWatched: 127,
  seriesWatched: 34,
  bjkMatches: 26,
  trips: 8,
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROFILE
    const parsed = JSON.parse(raw) as Partial<Profile>
    return { ...DEFAULT_PROFILE, ...parsed }
  } catch {
    return DEFAULT_PROFILE
  }
}

let profile: Profile = load()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const getSnapshot = () => profile

function commit(next: Profile) {
  profile = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — edits just won't survive a reload */
  }
  for (const fn of listeners) fn()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    profile = load()
    for (const fn of listeners) fn()
  })
}

export function useProfile() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const patch = useCallback((changes: Partial<Profile>) => {
    commit({ ...profile, ...changes })
  }, [])

  const bump = useCallback((field: keyof Profile, by: number) => {
    const current = profile[field]
    if (typeof current !== 'number') return
    commit({ ...profile, [field]: Math.max(0, current + by) })
  }, [])

  const reset = useCallback(() => commit(DEFAULT_PROFILE), [])

  return { profile: value, patch, bump, reset }
}
