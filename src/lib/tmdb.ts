/**
 * Minimal client for The Movie Database (TMDB) API.
 *
 * Bring-your-own-key: RonalJarvis never ships, proxies or logs a key.
 * Whatever the operator pastes into Settings is kept only in this browser's
 * localStorage and sent straight to api.themoviedb.org — nowhere else. A
 * free key (either the classic v3 "API Key" or the longer v4 "Read Access
 * Token" — both work here) comes from themoviedb.org/settings/api.
 */

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'

export interface TmdbListItem {
  id: number
  title: string
  overview: string
  release_date: string
  vote_average: number
  poster_path: string | null
  genre_ids: number[]
}

interface TmdbListResponse {
  page: number
  results: TmdbListItem[]
  total_pages: number
  total_results: number
}

interface TmdbVideo {
  key: string
  site: string
  type: string
  official: boolean
}

interface TmdbGenre {
  id: number
  name: string
}

interface TmdbDetail extends TmdbListItem {
  runtime: number | null
  tagline: string | null
  genres: TmdbGenre[]
  videos?: { results: TmdbVideo[] }
}

export type TmdbErrorCode = 'UNAUTHORIZED' | 'NETWORK' | 'UNKNOWN'

export type TmdbResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TmdbErrorCode; message: string }

/**
 * The v4 read-access token is a long JWT (three dot-separated segments); the
 * classic v3 key is a 32-char hex string. Detect which one was pasted rather
 * than asking the operator to know the difference.
 */
function authFor(key: string): { headers: HeadersInit; query: string } {
  const isV4 = key.split('.').length === 3 || key.length > 40
  return isV4
    ? { headers: { Authorization: `Bearer ${key}` }, query: '' }
    : { headers: {}, query: `&api_key=${encodeURIComponent(key)}` }
}

async function request<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<TmdbResult<T>> {
  const { headers, query } = authFor(apiKey)
  const qs = new URLSearchParams({ language: 'de-DE', ...params }).toString()

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}?${qs}${query}`, { headers })
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Keine Verbindung zu TMDB — Netzwerk prüfen.' }
  }

  if (response.status === 401) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Schlüssel abgelehnt — in den Einstellungen prüfen.',
    }
  }
  if (!response.ok) {
    return { ok: false, code: 'UNKNOWN', message: `TMDB antwortete mit Status ${response.status}.` }
  }
  try {
    return { ok: true, data: (await response.json()) as T }
  } catch {
    return { ok: false, code: 'UNKNOWN', message: 'Antwort von TMDB konnte nicht gelesen werden.' }
  }
}

export function posterUrl(path: string | null, size: 'w342' | 'w500' = 'w342'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}

/** Lightweight endpoint made for exactly this: does the key work at all. */
export async function validateApiKey(apiKey: string): Promise<TmdbResult<true>> {
  const result = await request<unknown>('/authentication', apiKey)
  return result.ok ? { ok: true, data: true } : result
}

let genreCache: { key: string; map: Record<number, string> } | null = null

/** Genre id → name never changes for a given key/language, so fetch it once. */
export async function getGenreMap(apiKey: string): Promise<Record<number, string>> {
  if (genreCache?.key === apiKey) return genreCache.map
  const result = await request<{ genres: TmdbGenre[] }>('/genre/movie/list', apiKey)
  const map = result.ok ? Object.fromEntries(result.data.genres.map((g) => [g.id, g.name])) : {}
  genreCache = { key: apiKey, map }
  return map
}

export function fetchPopular(apiKey: string, page: number) {
  return request<TmdbListResponse>('/movie/popular', apiKey, { page: String(page) })
}

export function fetchNowPlaying(apiKey: string, page: number) {
  return request<TmdbListResponse>('/movie/now_playing', apiKey, { page: String(page), region: 'DE' })
}

export function searchMovies(apiKey: string, query: string, page: number) {
  return request<TmdbListResponse>('/search/movie', apiKey, { query, page: String(page) })
}

export function fetchMovieDetail(apiKey: string, id: number) {
  return request<TmdbDetail>(`/movie/${id}`, apiKey, { append_to_response: 'videos' })
}

export function bestTrailerKey(videos: TmdbVideo[] | undefined): string | null {
  if (!videos?.length) return null
  const onYouTube = videos.filter((v) => v.site === 'YouTube')
  const trailer = onYouTube.filter((v) => v.type === 'Trailer')
  return (trailer.find((v) => v.official) ?? trailer[0] ?? onYouTube[0])?.key ?? null
}

export interface TmdbDetailView {
  runtime: number
  tagline: string
  genre: string
  trailerKey: string | null
}

export async function loadDetail(apiKey: string, tmdbId: number): Promise<TmdbDetailView | null> {
  const result = await fetchMovieDetail(apiKey, tmdbId)
  if (!result.ok) return null
  const { data } = result
  return {
    runtime: data.runtime ?? 0,
    tagline: data.tagline ?? '',
    genre: data.genres.map((g) => g.name).join(' / '),
    trailerKey: bestTrailerKey(data.videos?.results),
  }
}
