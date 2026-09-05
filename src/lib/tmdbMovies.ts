import type { Movie, PosterArt } from '../data/movies'
import { seeded } from './motion'
import { posterUrl, type TmdbListItem } from './tmdb'

const ART_POOL: PosterArt[] = ['rings', 'grid', 'sun', 'wave', 'monolith']

const PALETTE_POOL: Array<[string, string]> = [
  ['#c98b3f', '#3a1f0c'],
  ['#ff8a3d', '#2a0f2e'],
  ['#5b7fa8', '#080d18'],
  ['#3f8fa8', '#0a1620'],
  ['#6f7f6a', '#101812'],
  ['#d9603a', '#1a0c08'],
  ['#e08b2c', '#2b1305'],
  ['#4a89c9', '#0b1524'],
  ['#7a8fa3', '#0d1218'],
]

/** Deterministic per-movie look, used as the poster fallback and the hover accent. */
function fallbackLook(seed: number): { art: PosterArt; palette: [string, string] } {
  const rand = seeded(seed)
  return {
    art: ART_POOL[Math.floor(rand() * ART_POOL.length)],
    palette: PALETTE_POOL[Math.floor(rand() * PALETTE_POOL.length)],
  }
}

/** Maps one TMDB list entry into the app's source-agnostic Movie shape. */
export function movieFromTmdb(
  item: TmdbListItem,
  genreMap: Record<number, string>,
  badge: string,
): Movie {
  const { art, palette } = fallbackLook(item.id)
  const genre = item.genre_ids.map((id) => genreMap[id]).filter(Boolean).slice(0, 2).join(' / ')
  return {
    id: `tmdb-${item.id}`,
    tmdbId: item.id,
    title: item.title.toUpperCase(),
    year: item.release_date ? new Date(item.release_date).getFullYear() : 0,
    genre: genre || 'FILM',
    runtime: 0,
    rating: item.vote_average,
    tagline: '',
    synopsis: item.overview || 'Keine Beschreibung verfügbar.',
    palette,
    art,
    status: badge,
    posterUrl: posterUrl(item.poster_path, 'w342'),
  }
}
