/**
 * Client for fortnite-api.com — a free, community-run, keyless API that
 * mirrors Epic's public Fortnite data (server status, active playlists,
 * shop, news). No registration needed for these endpoints; an optional key
 * (fortnite-api.com/dashboard) only raises the rate limit.
 *
 * What this can *not* do: Epic never published a public schedule for
 * competitive Cups/FNCS. That calendar is only visible in-game or through
 * Epic's authenticated tournament API, which needs a full Epic account
 * login — not something a static site can do. The Cup calendar in this
 * module is therefore an honestly-labelled illustrative schedule (real cup
 * names and their real weekly cadence), not a live feed — see fortniteCups.ts.
 */

const API_BASE = 'https://fortnite-api.com'

export interface FortniteStatus {
  online: boolean
}

export interface FortnitePlaylist {
  id: string
  name: string | null
  subName: string | null
  description: string | null
  image: string | null
}

export interface FortniteNewsItem {
  title: string
  body: string | null
  image: string | null
}

export type FortniteResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'NETWORK' | 'UNKNOWN'; message: string }

async function request<T>(path: string, apiKey?: string | null): Promise<FortniteResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: apiKey ? { Authorization: apiKey } : undefined,
    })
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Keine Verbindung zu fortnite-api.com.' }
  }
  if (!response.ok) {
    return { ok: false, code: 'UNKNOWN', message: `fortnite-api.com antwortete mit Status ${response.status}.` }
  }
  try {
    const json = (await response.json()) as { data: T }
    return { ok: true, data: json.data }
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Antwort konnte nicht gelesen werden.' }
  }
}

export function fetchStatus(apiKey?: string | null) {
  return request<FortniteStatus>('/v2/status', apiKey)
}

interface RawPlaylist {
  id: string
  name?: string | null
  subName?: string | null
  description?: string | null
  images?: { showcase?: string | null } | null
}

export async function fetchActivePlaylists(apiKey?: string | null): Promise<FortniteResult<FortnitePlaylist[]>> {
  const result = await request<RawPlaylist[]>('/v2/playlists', apiKey)
  if (!result.ok) return result
  const mapped = result.data
    // Ranked/limited-time/event playlists are what reads as "current events" —
    // the endless list of core Battle Royale duo/squad variants doesn't.
    .filter((p) => /event|cup|tournament|limited|ltm/i.test(`${p.id} ${p.name ?? ''}`))
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      name: p.name ?? null,
      subName: p.subName ?? null,
      description: p.description ?? null,
      image: p.images?.showcase ?? null,
    }))
  return { ok: true, data: mapped }
}

interface RawNewsMotd {
  title: string
  body?: string | null
  image?: string | null
}

export async function fetchBrNews(apiKey?: string | null): Promise<FortniteResult<FortniteNewsItem[]>> {
  const result = await request<{ motds?: RawNewsMotd[]; messages?: RawNewsMotd[] }>('/v2/news/br', apiKey)
  if (!result.ok) return result
  const items = result.data.motds ?? result.data.messages ?? []
  return {
    ok: true,
    data: items.slice(0, 6).map((m) => ({ title: m.title, body: m.body ?? null, image: m.image ?? null })),
  }
}


/* -------------------------------------------------------------------------- */
/* Cosmetic artwork                                                           */
/* -------------------------------------------------------------------------- */

export interface FortniteArt {
  id: string
  name: string
  image: string
}

interface RawCosmetic {
  id: string
  name?: string | null
  type?: { value?: string } | null
  images?: { icon?: string | null; featured?: string | null; smallIcon?: string | null } | null
}

let artCache: Promise<FortniteArt[]> | null = null

/**
 * Real outfit artwork to illustrate the cup cards, the way Fortnite Tracker
 * does. Keyless, and bounded in size: the "new cosmetics" feed is a short
 * list, with the item shop as a second try. Failure yields an empty array and
 * the cards simply render without art.
 */
export function fetchCosmeticArt(): Promise<FortniteArt[]> {
  if (artCache) return artCache

  artCache = (async () => {
    const pick = (items: RawCosmetic[]): FortniteArt[] =>
      items
        .filter((c) => (c.type?.value ?? '').toLowerCase() === 'outfit')
        .map((c) => ({
          id: c.id,
          name: c.name ?? c.id,
          image: c.images?.featured ?? c.images?.icon ?? c.images?.smallIcon ?? '',
        }))
        .filter((c) => c.image)

    const fresh = await request<{ items?: RawCosmetic[] }>('/v2/cosmetics/br/new')
    if (fresh.ok) {
      const art = pick(fresh.data.items ?? [])
      if (art.length) return art
    }

    interface ShopEntry { items?: RawCosmetic[]; brItems?: RawCosmetic[] }
    const shop = await request<{ featured?: { entries?: ShopEntry[] }; entries?: ShopEntry[] }>('/v2/shop')
    if (shop.ok) {
      const entries = shop.data.entries ?? shop.data.featured?.entries ?? []
      const items = entries.flatMap((e) => e.brItems ?? e.items ?? [])
      return pick(items)
    }
    return []
  })()

  return artCache
}
