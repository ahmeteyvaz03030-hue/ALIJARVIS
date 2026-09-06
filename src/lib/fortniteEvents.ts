/**
 * Live competitive data from fortniteapi.io.
 *
 * Why a second service: fortnite-api.com (used for status, playlists, news and
 * cosmetics) has no tournament endpoints, and Epic's own event API needs a
 * full account login. fortniteapi.io mirrors Epic's event windows and offers a
 * free key, so one key here covers both the real cup schedule and player
 * lookup. Without a key the app falls back to the generated estimate.
 *
 * The key lives only in this browser's localStorage and is sent only to
 * fortniteapi.io.
 */

const BASE = 'https://fortniteapi.io'

export type IoResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'UNAUTHORIZED' | 'NETWORK' | 'UNKNOWN'; message: string }

async function request<T>(path: string, apiKey: string): Promise<IoResult<T>> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { headers: { Authorization: apiKey } })
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Keine Verbindung zu fortniteapi.io.' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Schlüssel abgelehnt — in den Einstellungen prüfen.' }
  }
  if (!response.ok) {
    return { ok: false, code: 'UNKNOWN', message: `fortniteapi.io antwortete mit Status ${response.status}.` }
  }
  try {
    return { ok: true, data: (await response.json()) as T }
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Antwort konnte nicht gelesen werden.' }
  }
}

export function validateIoKey(apiKey: string) {
  return request<unknown>('/v1/events/list?lang=de', apiKey)
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export interface LiveCup {
  id: string
  name: string
  shortName: string
  region: string
  start: Date
  end: Date
  /** Poster/coverage art supplied by Epic, when present. */
  image: string | null
  playlist: string
}

/**
 * The upstream shape has shifted between API versions, so every field is read
 * defensively and anything unparseable is skipped rather than throwing.
 */
interface RawWindow {
  windowId?: string
  eventId?: string
  beginTime?: string
  endTime?: string
  region?: string
  regions?: string[]
  metadata?: Record<string, unknown>
}

interface RawEvent {
  eventId?: string
  id?: string
  name?: string
  displayName?: string
  shortDescription?: string
  regions?: string[]
  region?: string
  playlist?: string
  windows?: RawWindow[]
  image?: string
  poster?: string
}

/** A changed endpoint must degrade to "no cups", never take the view down. */
function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) if (typeof v === 'string' && v) return v
  return null
}

/** Region codes appear as EU, NAE, NAC, ASIA… — normalise to a short tag. */
function normaliseRegion(raw: string | null | undefined): string {
  if (!raw) return '—'
  const up = raw.toUpperCase()
  if (up.includes('EU')) return 'EU'
  if (up.includes('NAC') || up.includes('NAE')) return 'NAC'
  if (up.includes('NAW')) return 'NAW'
  if (up.includes('BR')) return 'BR'
  if (up.includes('ASIA')) return 'ASIA'
  if (up.includes('OCE')) return 'OCE'
  if (up.includes('ME')) return 'ME'
  return up.slice(0, 4)
}

export async function fetchLiveCups(apiKey: string, region = 'EU'): Promise<IoResult<LiveCup[]>> {
  const result = await request<{ events?: RawEvent[] }>(
    `/v1/events/list?lang=de&region=${encodeURIComponent(region)}`,
    apiKey,
  )
  if (!result.ok) return result

  const cups: LiveCup[] = []
  for (const event of asArray(result.data.events)) {
    const name =
      firstString(event.displayName, event.name, event.shortDescription, event.eventId, event.id) ??
      'Unbenannter Cup'
    const image = firstString(event.image, event.poster)
    for (const win of asArray(event.windows)) {
      const begin = firstString(win.beginTime)
      const end = firstString(win.endTime)
      if (!begin || !end) continue
      const start = new Date(begin)
      const finish = new Date(end)
      if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) continue
      cups.push({
        id: firstString(win.windowId, `${event.eventId ?? event.id}-${begin}`) ?? begin,
        name,
        shortName: name.replace(/\s*\(.*\)$/, ''),
        region: normaliseRegion(
          firstString(win.region, win.regions?.[0], event.region, event.regions?.[0]),
        ),
        start,
        end: finish,
        image,
        playlist: firstString(event.playlist) ?? '',
      })
    }
  }

  cups.sort((a, b) => a.start.getTime() - b.start.getTime())
  return { ok: true, data: cups }
}

/* -------------------------------------------------------------------------- */
/* Player lookup                                                              */
/* -------------------------------------------------------------------------- */

export interface PlayerStats {
  accountId: string
  name: string
  /** Overall lifetime numbers; `null` when the account hides its stats. */
  overall: {
    matches: number
    wins: number
    kills: number
    kd: number
    winRate: number
    top10: number
    minutesPlayed: number
  } | null
  perMode: Array<{ mode: string; matches: number; wins: number; kd: number }>
}

interface RawStatBlock {
  matchesplayed?: number
  placetop1?: number
  kills?: number
  kd?: number
  winrate?: number
  placetop10?: number
  minutesplayed?: number
}

function readBlock(b: RawStatBlock | undefined) {
  if (!b) return null
  return {
    matches: b.matchesplayed ?? 0,
    wins: b.placetop1 ?? 0,
    kills: b.kills ?? 0,
    kd: b.kd ?? 0,
    winRate: b.winrate ?? 0,
    top10: b.placetop10 ?? 0,
    minutesPlayed: b.minutesplayed ?? 0,
  }
}

export async function lookupPlayer(apiKey: string, username: string): Promise<IoResult<PlayerStats>> {
  const lookup = await request<{ account_id?: string; result?: boolean }>(
    `/v1/lookup?username=${encodeURIComponent(username)}`,
    apiKey,
  )
  if (!lookup.ok) return lookup
  const accountId = lookup.data.account_id
  if (!accountId) {
    return { ok: false, code: 'UNKNOWN', message: `Kein Konto mit dem Namen „${username}" gefunden.` }
  }

  const stats = await request<{
    name?: string
    global_stats?: Record<string, RawStatBlock>
    account?: { name?: string }
  }>(`/v1/stats?account=${encodeURIComponent(accountId)}`, apiKey)
  if (!stats.ok) return stats

  const global = stats.data.global_stats ?? {}
  const modes = Object.entries(global)
  // "Overall" is the sum across modes; the API doesn't hand it over directly.
  const totals = modes.reduce(
    (acc, [, b]) => {
      const v = readBlock(b)
      if (!v) return acc
      acc.matches += v.matches
      acc.wins += v.wins
      acc.kills += v.kills
      acc.top10 += v.top10
      acc.minutesPlayed += v.minutesPlayed
      return acc
    },
    { matches: 0, wins: 0, kills: 0, top10: 0, minutesPlayed: 0 },
  )

  const deaths = Math.max(1, totals.matches - totals.wins)
  return {
    ok: true,
    data: {
      accountId,
      name: stats.data.name ?? stats.data.account?.name ?? username,
      overall: totals.matches
        ? {
            ...totals,
            kd: totals.kills / deaths,
            winRate: (totals.wins / totals.matches) * 100,
          }
        : null,
      perMode: modes
        .map(([mode, b]) => {
          const v = readBlock(b)
          return v ? { mode: mode.toUpperCase(), matches: v.matches, wins: v.wins, kd: v.kd } : null
        })
        .filter((x): x is { mode: string; matches: number; wins: number; kd: number } => x !== null)
        .filter((m) => m.matches > 0)
        .sort((a, b) => b.matches - a.matches),
    },
  }
}
