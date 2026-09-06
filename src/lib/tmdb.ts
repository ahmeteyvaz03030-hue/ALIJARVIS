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
  /** Series carry per-episode minutes here instead of `runtime`. */
  episode_run_time?: number[]
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

export function fetchMovieDetail(apiKey: string, id: number, mediaType: 'movie' | 'tv' = 'movie') {
  return request<TmdbDetail>(`/${mediaType}/${id}`, apiKey, { append_to_response: 'videos' })
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

export async function loadDetail(
  apiKey: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv' = 'movie',
): Promise<TmdbDetailView | null> {
  const result = await fetchMovieDetail(apiKey, tmdbId, mediaType)
  if (!result.ok) return null
  const { data } = result
  // Series report per-episode minutes as a list; a movie has one `runtime`.
  const runtime = data.runtime ?? data.episode_run_time?.[0] ?? 0
  return {
    runtime,
    tagline: data.tagline ?? '',
    genre: data.genres.map((g) => g.name).join(' / '),
    trailerKey: bestTrailerKey(data.videos?.results),
  }
}


/* -------------------------------------------------------------------------- */
/* TV, upcoming, stills and people                                            */
/* -------------------------------------------------------------------------- */

export interface TmdbTvItem {
  id: number
  name: string
  overview: string
  first_air_date: string
  vote_average: number
  poster_path: string | null
  genre_ids: number[]
}

interface TmdbTvResponse {
  page: number
  results: TmdbTvItem[]
  total_pages: number
  total_results: number
}

export function fetchPopularTv(apiKey: string, page: number) {
  return request<TmdbTvResponse>('/tv/popular', apiKey, { page: String(page) })
}

export function fetchOnTheAirTv(apiKey: string, page: number) {
  return request<TmdbTvResponse>('/tv/on_the_air', apiKey, { page: String(page) })
}

export function searchTv(apiKey: string, query: string, page: number) {
  return request<TmdbTvResponse>('/search/tv', apiKey, { query, page: String(page) })
}

export function fetchUpcomingMovies(apiKey: string, page: number) {
  return request<TmdbListResponse>('/movie/upcoming', apiKey, { page: String(page), region: 'DE' })
}

/** Genre ids differ between the movie and tv endpoints. */
let tvGenreCache: { key: string; map: Record<number, string> } | null = null

export async function getTvGenreMap(apiKey: string): Promise<Record<number, string>> {
  if (tvGenreCache?.key === apiKey) return tvGenreCache.map
  const result = await request<{ genres: TmdbGenre[] }>('/genre/tv/list', apiKey)
  const map = result.ok ? Object.fromEntries(result.data.genres.map((g) => [g.id, g.name])) : {}
  tvGenreCache = { key: apiKey, map }
  return map
}

/* --- stills ---------------------------------------------------------------- */

export interface TmdbStill {
  url: string
  thumbUrl: string
  width: number
  height: number
}

export function stillUrl(path: string, size: 'w780' | 'original' = 'w780'): string {
  return `${IMAGE_BASE}/${size}${path}`
}

/**
 * Scene stills (backdrops). `include_image_language` keeps language-neutral
 * artwork in the result, which is what most backdrops are.
 */
export async function fetchStills(
  apiKey: string,
  id: number,
  mediaType: 'movie' | 'tv' = 'movie',
): Promise<TmdbStill[]> {
  const result = await request<{ backdrops?: Array<{ file_path: string; width: number; height: number }> }>(
    `/${mediaType}/${id}/images`,
    apiKey,
    { include_image_language: 'de,en,null' },
  )
  if (!result.ok) return []
  return (result.data.backdrops ?? []).slice(0, 12).map((b) => ({
    url: stillUrl(b.file_path, 'original'),
    thumbUrl: stillUrl(b.file_path, 'w780'),
    width: b.width,
    height: b.height,
  }))
}

/* --- people ---------------------------------------------------------------- */

export interface TmdbPersonSummary {
  id: number
  name: string
  profileUrl: string | null
  knownFor: string
  popularity: number
}

export interface TmdbCredit {
  id: number
  title: string
  mediaType: 'movie' | 'tv'
  character: string
  date: string | null
  posterUrl: string | null
  rating: number
  /** No release date yet, or a date still in the future. */
  upcoming: boolean
}

export interface TmdbPersonDetail {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  placeOfBirth: string | null
  knownForDepartment: string
  profileUrl: string | null
  credits: TmdbCredit[]
}

interface RawPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  popularity?: number
  known_for?: Array<{ title?: string; name?: string }>
}

export async function searchPeople(apiKey: string, query: string): Promise<TmdbResult<TmdbPersonSummary[]>> {
  const result = await request<{ results: RawPerson[] }>('/search/person', apiKey, { query })
  if (!result.ok) return result
  return {
    ok: true,
    data: result.data.results.slice(0, 12).map((p) => ({
      id: p.id,
      name: p.name,
      profileUrl: p.profile_path ? `${IMAGE_BASE}/w185${p.profile_path}` : null,
      knownFor: (p.known_for ?? []).map((k) => k.title ?? k.name ?? '').filter(Boolean).slice(0, 3).join(', '),
      popularity: p.popularity ?? 0,
    })),
  }
}

interface RawCredit {
  id: number
  title?: string
  name?: string
  media_type?: string
  character?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  vote_average?: number
}

export async function fetchPerson(apiKey: string, id: number): Promise<TmdbPersonDetail | null> {
  const result = await request<{
    id: number
    name: string
    biography?: string
    birthday?: string | null
    deathday?: string | null
    place_of_birth?: string | null
    known_for_department?: string
    profile_path?: string | null
    combined_credits?: { cast?: RawCredit[] }
  }>(`/person/${id}`, apiKey, { append_to_response: 'combined_credits' })
  if (!result.ok) return null
  const d = result.data
  const today = new Date().toISOString().slice(0, 10)

  const credits = (d.combined_credits?.cast ?? [])
    .map((c): TmdbCredit => {
      const date = c.release_date || c.first_air_date || null
      return {
        id: c.id,
        title: c.title ?? c.name ?? 'Ohne Titel',
        mediaType: c.media_type === 'tv' ? 'tv' : 'movie',
        character: c.character ?? '',
        date,
        posterUrl: c.poster_path ? `${IMAGE_BASE}/w185${c.poster_path}` : null,
        rating: c.vote_average ?? 0,
        // No date at all usually means announced-but-unscheduled, which is
        // the closest thing TMDB has to "rumoured".
        upcoming: !date || date > today,
      }
    })
    .sort((a, b) => (b.date ?? '9999').localeCompare(a.date ?? '9999'))

  return {
    id: d.id,
    name: d.name,
    biography: d.biography ?? '',
    birthday: d.birthday ?? null,
    deathday: d.deathday ?? null,
    placeOfBirth: d.place_of_birth ?? null,
    knownForDepartment: d.known_for_department ?? '',
    profileUrl: d.profile_path ? `${IMAGE_BASE}/w342${d.profile_path}` : null,
    credits,
  }
}
