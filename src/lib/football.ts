/**
 * Beşiktaş fixtures and the Süper Lig table.
 *
 * Source: TheSportsDB (thesportsdb.com) — a free, CORS-enabled sports
 * database. The free tier works without a personal key; a supporter key can
 * be supplied in the settings if the shared one is rate-limited.
 *
 * Everything here resolves rather than throws: no network in a hotel Wi-Fi is
 * a normal Tuesday, and the panel says so instead of going blank.
 */

const DEFAULT_KEY = '123'
const BASE = (key: string) => `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}`

/** The club everything on this page is about. */
export const CLUB = {
  name: 'Beşiktaş JK',
  searchName: 'Besiktas',
  nickname: 'Kara Kartallar',
  crest: '🦅',
}

export type FootballResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

async function get<T>(path: string, key: string): Promise<FootballResult<T>> {
  let response: Response
  try {
    response = await fetch(`${BASE(key)}/${path}`)
  } catch {
    return { ok: false, message: 'Sportdatenbank nicht erreichbar.' }
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: 'Schlüssel für die Sportdatenbank abgelehnt.' }
  }
  if (!response.ok) {
    return { ok: false, message: `Sportdatenbank antwortete mit Status ${response.status}.` }
  }
  try {
    return { ok: true, data: (await response.json()) as T }
  } catch {
    return { ok: false, message: 'Antwort der Sportdatenbank konnte nicht gelesen werden.' }
  }
}

/** TheSportsDB answers with `null` for "nothing found" and has changed field
 *  shapes between versions — never iterate its payload unguarded. */
function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

/* -------------------------------------------------------------------------- */
/* Team                                                                       */
/* -------------------------------------------------------------------------- */

export interface Team {
  id: string
  leagueId: string
  name: string
  league: string
  stadium: string
  badge: string | null
}

interface RawTeam {
  idTeam?: string
  idLeague?: string
  strTeam?: string
  strLeague?: string
  strStadium?: string
  strBadge?: string
  strTeamBadge?: string
}

export async function findTeam(key = DEFAULT_KEY): Promise<FootballResult<Team>> {
  const result = await get<{ teams?: RawTeam[] | null }>(
    `searchteams.php?t=${encodeURIComponent(CLUB.searchName)}`,
    key,
  )
  if (!result.ok) return result
  const raw = asArray(result.data.teams)[0]
  if (!raw?.idTeam) return { ok: false, message: `${CLUB.name} nicht in der Datenbank gefunden.` }
  return {
    ok: true,
    data: {
      id: raw.idTeam,
      leagueId: raw.idLeague ?? '',
      name: raw.strTeam ?? CLUB.name,
      league: raw.strLeague ?? 'Süper Lig',
      stadium: raw.strStadium ?? '',
      badge: raw.strBadge ?? raw.strTeamBadge ?? null,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

export interface Fixture {
  id: string
  /** Full label, e.g. "Beşiktaş vs Galatasaray". */
  name: string
  home: string
  away: string
  /** `null` when the kick-off time has not been confirmed yet. */
  kickoff: Date | null
  /** Date string as published, for fixtures without a confirmed time. */
  dateLabel: string
  competition: string
  venue: string
  /** Set on finished matches only. */
  score: { home: number; away: number } | null
  /** True when Beşiktaş play at home. */
  atHome: boolean
}

interface RawEvent {
  idEvent?: string
  strEvent?: string
  strHomeTeam?: string
  strAwayTeam?: string
  dateEvent?: string
  strTime?: string
  strTimestamp?: string
  strLeague?: string
  strVenue?: string
  intHomeScore?: string | null
  intAwayScore?: string | null
}

function toFixture(raw: RawEvent): Fixture | null {
  if (!raw.idEvent) return null
  const home = raw.strHomeTeam ?? '—'
  const away = raw.strAwayTeam ?? '—'
  // strTimestamp is UTC and preferred; the split date/time fields are the
  // fallback for older rows, where an unconfirmed kick-off reads "00:00:00".
  let kickoff: Date | null = null
  if (raw.strTimestamp) {
    const parsed = new Date(raw.strTimestamp.replace(' ', 'T') + (raw.strTimestamp.endsWith('Z') ? '' : 'Z'))
    if (!Number.isNaN(parsed.getTime())) kickoff = parsed
  }
  if (!kickoff && raw.dateEvent && raw.strTime && raw.strTime !== '00:00:00') {
    const parsed = new Date(`${raw.dateEvent}T${raw.strTime}Z`)
    if (!Number.isNaN(parsed.getTime())) kickoff = parsed
  }
  const hs = raw.intHomeScore
  const as = raw.intAwayScore
  const score =
    hs !== null && hs !== undefined && hs !== '' && as !== null && as !== undefined && as !== ''
      ? { home: Number(hs), away: Number(as) }
      : null

  return {
    id: raw.idEvent,
    name: raw.strEvent ?? `${home} vs ${away}`,
    home,
    away,
    kickoff,
    dateLabel: raw.dateEvent ?? '—',
    competition: raw.strLeague ?? '',
    venue: raw.strVenue ?? '',
    score,
    atHome: /be[sş]ikta[sş]/i.test(home),
  }
}

export async function fetchNextFixtures(
  teamId: string,
  key = DEFAULT_KEY,
): Promise<FootballResult<Fixture[]>> {
  const result = await get<{ events?: RawEvent[] | null }>(`eventsnext.php?id=${teamId}`, key)
  if (!result.ok) return result
  const fixtures = asArray(result.data.events)
    .map(toFixture)
    .filter((f): f is Fixture => f !== null)
    .sort((a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0))
  return { ok: true, data: fixtures }
}

export async function fetchLastResults(
  teamId: string,
  key = DEFAULT_KEY,
): Promise<FootballResult<Fixture[]>> {
  const result = await get<{ results?: RawEvent[] | null }>(`eventslast.php?id=${teamId}`, key)
  if (!result.ok) return result
  const fixtures = asArray(result.data.results)
    .map(toFixture)
    .filter((f): f is Fixture => f !== null)
    .sort((a, b) => (b.kickoff?.getTime() ?? 0) - (a.kickoff?.getTime() ?? 0))
  return { ok: true, data: fixtures }
}

/* -------------------------------------------------------------------------- */
/* League table                                                               */
/* -------------------------------------------------------------------------- */

export interface TableRow {
  rank: number
  team: string
  played: number
  win: number
  draw: number
  loss: number
  goalsFor: number
  goalsAgainst: number
  diff: number
  points: number
  badge: string | null
}

interface RawRow {
  intRank?: string | number
  strTeam?: string
  intPlayed?: string | number
  intWin?: string | number
  intDraw?: string | number
  intLoss?: string | number
  intGoalsFor?: string | number
  intGoalsAgainst?: string | number
  intGoalDifference?: string | number
  intPoints?: string | number
  strBadge?: string
}

const num = (v: string | number | undefined) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Süper Lig runs August → May, so a season spans two calendar years. */
export function currentSeason(at = new Date()): string {
  const y = at.getFullYear()
  return at.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export async function fetchTable(
  leagueId: string,
  season: string,
  key = DEFAULT_KEY,
): Promise<FootballResult<TableRow[]>> {
  const result = await get<{ table?: RawRow[] | null }>(
    `lookuptable.php?l=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`,
    key,
  )
  if (!result.ok) return result
  const rows = asArray(result.data.table)
    .map((r, i) => ({
      rank: num(r.intRank) || i + 1,
      team: r.strTeam ?? '—',
      played: num(r.intPlayed),
      win: num(r.intWin),
      draw: num(r.intDraw),
      loss: num(r.intLoss),
      goalsFor: num(r.intGoalsFor),
      goalsAgainst: num(r.intGoalsAgainst),
      diff: num(r.intGoalDifference),
      points: num(r.intPoints),
      badge: r.strBadge ?? null,
    }))
    .sort((a, b) => a.rank - b.rank)
  if (!rows.length) return { ok: false, message: `Keine Tabelle für die Saison ${season} hinterlegt.` }
  return { ok: true, data: rows }
}

export const isBesiktas = (name: string) => /be[sş]ikta[sş]/i.test(name)

/** Everything the Beşiktaş module needs, in one call. */
export interface FootballSnapshot {
  team: Team | null
  next: Fixture[]
  last: Fixture[]
  table: TableRow[]
  season: string
  /** Non-fatal problems worth showing (e.g. table missing but fixtures fine). */
  notes: string[]
}

export async function loadFootball(key = DEFAULT_KEY): Promise<FootballResult<FootballSnapshot>> {
  const teamResult = await findTeam(key)
  if (!teamResult.ok) return teamResult
  const team = teamResult.data
  const season = currentSeason()

  const [next, last, table] = await Promise.all([
    fetchNextFixtures(team.id, key),
    fetchLastResults(team.id, key),
    team.leagueId
      ? fetchTable(team.leagueId, season, key)
      : Promise.resolve({ ok: false as const, message: 'Liga-Kennung fehlt.' }),
  ])

  const notes: string[] = []
  if (!next.ok) notes.push(next.message)
  if (!last.ok) notes.push(last.message)
  if (!table.ok) notes.push(table.message)

  return {
    ok: true,
    data: {
      team,
      next: next.ok ? next.data : [],
      last: last.ok ? last.data : [],
      table: table.ok ? table.data : [],
      season,
      notes,
    },
  }
}
