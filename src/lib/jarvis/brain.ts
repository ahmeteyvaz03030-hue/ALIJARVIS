/**
 * RonalJarvis's answering layer.
 *
 * The point of this module is that Ali should not have to know which panel a
 * fact lives behind. Every intent here reaches into the same data hub the
 * modules render from, so an answer is never a second, staler copy of what the
 * dashboard already shows — it *is* that data, phrased.
 *
 * Answers are structured (a line plus blocks) rather than one long string, so
 * the chat can render a real briefing or a stats grid instead of a paragraph.
 */

import type { HubKey, HubShape } from '../../state/DataHub'
import { resolveCups } from '../../state/DataHub'
import type { Settings } from '../../state/SystemProvider'
import type { WatchlistEntry } from '../../state/useWatchlist'
import type { Todo } from '../../state/useTodos'
import type { Profile } from '../../state/useProfile'
import { DESTINATION, ORIGIN, PHASE_LABEL, TRIP, type FlightPhase } from '../config'
import { currentWeather, forecast } from '../../data/weather'
import { MOVIES } from '../../data/movies'
import { POIS } from '../../data/marmaris'
import { CLUB, isBesiktas, type Fixture } from '../football'
import { MODE_SPEC, type JarvisMode } from '../jarvisModes'
import { cachedRate, eurToTry, fetchRate, formatEur, formatTry, tryToEur } from '../currency'
import { bandFor, cm360, eDPI } from '../sensitivity'
import { extractAmount, extractGenre, resolveIntent, type Intent } from './intents'
import { answer, type BriefingSection, type JarvisAnswer, type ListItem } from './types'

export interface BrainContext {
  ensure: <K extends HubKey>(key: K) => Promise<HubShape[K]>
  settings: Settings
  phase: FlightPhase
  mode: JarvisMode
  stats: { cpu: number; network: number; ping: number }
  watchlist: WatchlistEntry[]
  todos: Todo[]
  openTodos: Todo[]
  unreadFromTony: number
  profile: Profile
  /** Stored aim-training bests, keyed by drill. */
  aimBests: Partial<Record<string, { score: number; accuracy: number }>>
  sens: { dpi: number; sens: number }
}

/* -------------------------------------------------------------------------- */
/* Shared formatting                                                          */
/* -------------------------------------------------------------------------- */

const nf = new Intl.NumberFormat('de-DE')

const dateTime = (d: Date) =>
  d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const clock = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

function daysHours(target: Date, now = Date.now()) {
  const ms = Math.max(0, target.getTime() - now)
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    past: target.getTime() < now,
  }
}

function relativeDay(d: Date, now = Date.now()): string {
  const today = new Date(now)
  if (d.toDateString() === today.toDateString()) return 'heute'
  if (d.toDateString() === new Date(now + 86_400_000).toDateString()) return 'morgen'
  if (d.toDateString() === new Date(now - 86_400_000).toDateString()) return 'gestern'
  const days = Math.round((d.getTime() - now) / 86_400_000)
  if (days === 0) return d.getTime() > now ? 'gleich' : 'gerade eben'
  return days > 0 ? `in ${days} Tagen` : `vor ${Math.abs(days)} Tagen`
}

const fixtureLine = (f: Fixture) =>
  `${f.home} vs ${f.away}${f.kickoff ? ` · ${relativeDay(f.kickoff)} ${clock(f.kickoff)}` : ` · ${f.dateLabel}`}`

/* -------------------------------------------------------------------------- */
/* Intent handlers                                                            */
/* -------------------------------------------------------------------------- */

async function fortniteStats(ctx: BrainContext): Promise<JarvisAnswer> {
  if (!ctx.settings.fortniteApiKey) {
    return answer(
      'Für deine echten Fortnite-Zahlen brauche ich einen fortniteapi.io-Schlüssel — kostenlos, und er bleibt in diesem Browser. Trag ihn in den Einstellungen ein, dann hole ich die Statistiken selbst.',
      [],
      [{ label: 'Zu den Einstellungen', view: 'settings' }],
    )
  }
  if (!ctx.settings.epicName) {
    return answer(
      'Ich habe den Schlüssel, aber noch keinen Epic-Namen von dir. Trag ihn im Fortnite-Modul unter „Spieler-Tracker" ein und merk ihn dir — danach beantworte ich das hier direkt.',
      [],
      [{ label: 'Zum Spieler-Tracker', view: 'fortnite' }],
      [],
    )
  }

  const slice = await ctx.ensure('player')
  if (slice.status !== 'ready' || !slice.data) {
    return answer(
      slice.error ?? 'Die Spielerdaten kamen gerade nicht durch.',
      [{ kind: 'note', text: 'Ich versuche es beim nächsten Mal erneut.', tone: 'amber' }],
      [{ label: 'Zum Spieler-Tracker', view: 'fortnite' }],
      ['player'],
    )
  }

  const p = slice.data
  if (!p.overall) {
    return answer(
      `${p.name} hat die Statistiken auf privat gestellt — Epic gibt dann keine Zahlen heraus.`,
      [],
      [{ label: 'Zum Spieler-Tracker', view: 'fortnite' }],
      ['player'],
    )
  }

  const o = p.overall
  const best = p.perMode[0]
  return answer(
    `${p.name}: ${nf.format(o.wins)} Siege bei ${nf.format(o.matches)} Matches, K/D ${o.kd.toFixed(2)} und ${o.winRate.toFixed(1)} % Win-Rate.${best ? ` Am meisten unterwegs bist du in ${best.mode}.` : ''}`,
    [
      {
        kind: 'stats',
        rows: [
          { label: 'SIEGE', value: nf.format(o.wins), tone: 'lime' },
          { label: 'K/D', value: o.kd.toFixed(2), tone: 'violet' },
          { label: 'WIN-RATE', value: `${o.winRate.toFixed(1)} %`, tone: 'lime' },
          { label: 'MATCHES', value: nf.format(o.matches) },
          { label: 'KILLS', value: nf.format(o.kills) },
          { label: 'TOP 10', value: nf.format(o.top10) },
        ],
      },
      ...(p.perMode.length
        ? [
            {
              kind: 'list' as const,
              title: 'Nach Modus',
              items: p.perMode.slice(0, 4).map<ListItem>((m) => ({
                primary: m.mode,
                secondary: `${nf.format(m.matches)} Matches · ${nf.format(m.wins)} Siege`,
                trailing: `${m.kd.toFixed(2)} K/D`,
                tone: 'violet',
              })),
            },
          ]
        : []),
    ],
    [{ label: 'Tracker öffnen', view: 'fortnite' }],
    ['player'],
  )
}

async function fortniteCups(ctx: BrainContext): Promise<JarvisAnswer> {
  const slice = await ctx.ensure('fortnite')
  const cups = resolveCups(slice.data?.cups)
  const live = cups.live
  const next = cups.upcoming.slice(0, 5)
  const label = cups.source === 'live' ? 'echte Turnierfenster' : 'der Schätzkalender'

  if (!live.length && !next.length) {
    return answer(
      `Für Europa liegt gerade nichts an — weder laufend noch angesetzt (${label}).`,
      [],
      [{ label: 'Cups öffnen', view: 'fortnite' }],
      ['fortnite'],
    )
  }

  const first = next[0]
  const say = live.length
    ? `Gerade läuft ${live.length === 1 ? 'ein Cup' : `${live.length} Cups`}: ${live.map((c) => c.name).join(', ')}.${first ? ` Danach kommt ${first.name} ${relativeDay(first.start)} um ${clock(first.start)}.` : ''}`
    : `Als Nächstes läuft ${first.name} ${relativeDay(first.start)} um ${clock(first.start)} Uhr.`

  return answer(
    say,
    [
      ...(live.length
        ? [
            {
              kind: 'list' as const,
              title: 'Läuft gerade',
              items: live.map<ListItem>((c) => ({
                primary: c.name,
                secondary: `bis ${clock(c.end)}`,
                trailing: 'LIVE',
                tone: 'lime',
              })),
            },
          ]
        : []),
      {
        kind: 'list',
        title: 'Anstehend · Europa',
        items: next.map<ListItem>((c) => ({
          primary: c.name,
          secondary: `${relativeDay(c.start)} · ${clock(c.start)} – ${clock(c.end)}`,
          tone: 'violet',
        })),
      },
      ...(cups.source === 'estimate'
        ? [
            {
              kind: 'note' as const,
              text: 'Das ist der Schätzkalender — Epic veröffentlicht keinen offenen Spielplan. Mit einem fortniteapi.io-Schlüssel zeige ich die echten Fenster.',
              tone: 'amber' as const,
            },
          ]
        : []),
    ],
    [{ label: 'Cups öffnen', view: 'fortnite' }],
    ['fortnite'],
  )
}

function fortniteTraining(ctx: BrainContext): JarvisAnswer {
  const cm = cm360(ctx.sens.dpi, ctx.sens.sens)
  const band = bandFor(cm)
  const rows = Object.entries(ctx.aimBests).map(([drill, record]) => ({
    label: drill.toUpperCase(),
    value: record ? String(record.score) : '—',
    tone: 'violet' as const,
  }))

  return answer(
    `Du spielst auf ${ctx.sens.dpi} DPI und ${ctx.sens.sens} % — das sind ${cm.toFixed(1)} cm für eine volle Drehung, also ${band.label.toLowerCase()}. ${band.blurb}`,
    [
      {
        kind: 'stats',
        rows: [
          { label: 'eDPI', value: nf.format(Math.round(eDPI(ctx.sens.dpi, ctx.sens.sens))) },
          { label: 'CM / 360°', value: cm.toFixed(1), tone: 'lime' },
          { label: 'EINORDNUNG', value: band.label, tone: 'amber' },
        ],
      },
      ...(rows.length ? [{ kind: 'stats' as const, title: 'Aim-Bestwerte', rows }] : []),
      {
        kind: 'note',
        text: 'Im Training-Reiter misst die Flick-Kalibrierung, ob du systematisch über das Ziel hinausziehst, und schlägt eine Korrektur in Prozent vor.',
      },
    ],
    [{ label: 'Training öffnen', view: 'fortnite' }],
  )
}

async function besiktas(ctx: BrainContext): Promise<JarvisAnswer> {
  const slice = await ctx.ensure('football')
  if (slice.status !== 'ready' || !slice.data) {
    return answer(
      slice.error ?? 'Die Sportdatenbank antwortet gerade nicht.',
      [{ kind: 'note', text: 'Spielplan und Tabelle kommen von thesportsdb.com.', tone: 'amber' }],
      [{ label: 'Beşiktaş öffnen', view: 'besiktas' }],
      ['football'],
    )
  }

  const { next, table, last } = slice.data
  const own = table.find((r) => isBesiktas(r.team)) ?? null
  const nextMatch = next.find((f) => f.kickoff) ?? next[0] ?? null

  const say = nextMatch
    ? `${CLUB.name} spielt ${nextMatch.kickoff ? relativeDay(nextMatch.kickoff) : 'demnächst'}: ${nextMatch.home} gegen ${nextMatch.away}${nextMatch.kickoff ? ` um ${clock(nextMatch.kickoff)} Uhr` : ''}.${own ? ` In der Süper Lig steht ihr auf Platz ${own.rank} mit ${own.points} Punkten.` : ''}`
    : own
      ? `${CLUB.name} steht auf Platz ${own.rank} der Süper Lig mit ${own.points} Punkten. Ein nächstes Spiel ist noch nicht angesetzt.`
      : `Zu ${CLUB.name} habe ich gerade weder Spielplan noch Tabelle.`

  return answer(
    say,
    [
      ...(own
        ? [
            {
              kind: 'stats' as const,
              rows: [
                { label: 'PLATZ', value: String(own.rank), tone: 'lime' as const },
                { label: 'PUNKTE', value: String(own.points), tone: 'lime' as const },
                { label: 'SPIELE', value: String(own.played) },
                { label: 'TORDIFF', value: own.diff > 0 ? `+${own.diff}` : String(own.diff) },
              ],
            },
          ]
        : []),
      ...(next.length
        ? [
            {
              kind: 'list' as const,
              title: 'Nächste Spiele',
              items: next.slice(0, 4).map<ListItem>((f) => ({
                primary: `${f.home} vs ${f.away}`,
                secondary: f.kickoff
                  ? `${relativeDay(f.kickoff)} · ${clock(f.kickoff)} · ${f.competition}`
                  : `${f.dateLabel} · ${f.competition}`,
                trailing: f.atHome ? 'HEIM' : 'AUSWÄRTS',
                tone: 'amber',
              })),
            },
          ]
        : []),
      ...(last.length
        ? [
            {
              kind: 'list' as const,
              title: 'Zuletzt',
              items: last.slice(0, 3).map<ListItem>((f) => ({
                primary: `${f.home} vs ${f.away}`,
                secondary: f.kickoff ? relativeDay(f.kickoff) : f.dateLabel,
                trailing: f.score ? `${f.score.home}:${f.score.away}` : '—',
                tone: 'cyan',
              })),
            },
          ]
        : []),
    ],
    [{ label: 'Beşiktaş öffnen', view: 'besiktas' }],
    ['football'],
  )
}

async function moviesNew(ctx: BrainContext, wantSeries: boolean): Promise<JarvisAnswer> {
  if (!ctx.settings.tmdbApiKey) {
    const offline = MOVIES.slice(0, 5)
    return answer(
      'Ohne TMDB-Schlüssel läuft das Entertainment-Modul auf der Offline-Bibliothek. Da liegen aktuell diese Titel bereit:',
      [
        {
          kind: 'list',
          items: offline.map<ListItem>((m) => ({
            primary: m.title,
            secondary: `${m.genre} · ${m.year}`,
            trailing: m.status,
            tone: 'violet',
          })),
        },
        {
          kind: 'note',
          text: 'Mit einem kostenlosen TMDB-Schlüssel zeige ich echte Kinostarts, Serien und Schauspieler-Profile.',
          tone: 'amber',
        },
      ],
      [{ label: 'Zu den Einstellungen', view: 'settings' }],
    )
  }

  const slice = await ctx.ensure('releases')
  if (slice.status !== 'ready' || !slice.data) {
    return answer(
      slice.error ?? 'TMDB antwortet gerade nicht.',
      [],
      [{ label: 'Entertainment öffnen', view: 'movies' }],
      ['releases'],
    )
  }

  if (wantSeries) {
    return answer(
      'Serien lade ich direkt im Entertainment-Modul — dort liegen „Serien" (beliebt) und „Neue Folgen" nebeneinander, samt Trailer und Szenenbildern.',
      [
        {
          kind: 'note',
          text: 'Ich öffne dir den Serien-Reiter, dann siehst du sie mit Poster und Bewertung.',
        },
      ],
      [{ label: 'Serien öffnen', view: 'movies' }],
      ['releases'],
    )
  }

  const { nowPlaying, upcoming } = slice.data
  return answer(
    `Im Kino laufen gerade ${nowPlaying.length} Titel, und ${upcoming.length} weitere sind angekündigt. Ganz oben: ${nowPlaying[0]?.title ?? upcoming[0]?.title ?? '—'}.`,
    [
      ...(nowPlaying.length
        ? [
            {
              kind: 'list' as const,
              title: 'Jetzt im Kino',
              items: nowPlaying.slice(0, 5).map<ListItem>((m) => ({
                primary: m.title,
                secondary: m.release_date ? m.release_date.slice(0, 4) : '',
                trailing: m.vote_average ? `★ ${m.vote_average.toFixed(1)}` : undefined,
                tone: 'lime',
              })),
            },
          ]
        : []),
      ...(upcoming.length
        ? [
            {
              kind: 'list' as const,
              title: 'Demnächst',
              items: upcoming.slice(0, 5).map<ListItem>((m) => ({
                primary: m.title,
                secondary: m.release_date ?? '',
                tone: 'violet',
              })),
            },
          ]
        : []),
    ],
    [{ label: 'Entertainment öffnen', view: 'movies' }],
    ['releases'],
  )
}

async function recommend(ctx: BrainContext, question: string): Promise<JarvisAnswer> {
  const genre = extractGenre(question)

  // The watchlist is Ali's own shortlist, so it outranks anything I could find.
  const fromWatchlist = ctx.watchlist.filter(
    (e) => !genre || e.title.toLowerCase().includes(genre.key),
  )
  if (ctx.watchlist.length && (!genre || fromWatchlist.length)) {
    const pick = (fromWatchlist.length ? fromWatchlist : ctx.watchlist)[0]
    return answer(
      `Du hast ${ctx.watchlist.length} Titel auf der Merkliste — fang mit „${pick.title}" an${pick.year ? ` (${pick.year})` : ''}. Das hast du dir selbst vorgemerkt, das zählt mehr als jeder Vorschlag von mir.`,
      [
        {
          kind: 'list',
          title: 'Deine Merkliste',
          items: ctx.watchlist.slice(0, 5).map<ListItem>((e) => ({
            primary: e.title,
            secondary: `${e.mediaType === 'tv' ? 'Serie' : 'Film'}${e.year ? ` · ${e.year}` : ''}`,
            trailing: e.rating ? `★ ${e.rating.toFixed(1)}` : undefined,
            tone: 'amber',
          })),
        },
      ],
      [{ label: 'Merkliste öffnen', view: 'movies' }],
    )
  }

  if (ctx.settings.tmdbApiKey) {
    const slice = await ctx.ensure('releases')
    const pool = [...(slice.data?.nowPlaying ?? []), ...(slice.data?.upcoming ?? [])]
    if (pool.length) {
      const sorted = [...pool].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      const pick = sorted[0]
      return answer(
        genre
          ? `Nach ${genre.label} sortiert TMDB nicht in der Kinoliste — aber am besten bewertet ist gerade „${pick.title}" mit ★ ${pick.vote_average.toFixed(1)}. Im Entertainment-Modul kannst du direkt nach ${genre.label} suchen.`
          : `Nimm „${pick.title}" — mit ★ ${pick.vote_average.toFixed(1)} der bestbewertete Titel, der gerade läuft.`,
        [
          {
            kind: 'list',
            title: 'Top-bewertet gerade',
            items: sorted.slice(0, 5).map<ListItem>((m) => ({
              primary: m.title,
              secondary: m.release_date ? m.release_date.slice(0, 4) : '',
              trailing: `★ ${m.vote_average.toFixed(1)}`,
              tone: 'lime',
            })),
          },
        ],
        [{ label: 'Entertainment öffnen', view: 'movies' }],
        ['releases'],
      )
    }
  }

  // Offline library, filtered by the genre string the demo entries carry.
  const pool = genre
    ? MOVIES.filter((m) => m.genre.toLowerCase().includes(genre.key.slice(0, 4)))
    : MOVIES
  const pick = (pool.length ? pool : MOVIES)[0]
  return answer(
    genre
      ? `Aus der Offline-Bibliothek passt „${pick.title}" am besten zu ${genre.label} — ${pick.genre}, ${pick.year}.`
      : `Nimm „${pick.title}" (${pick.genre}, ${pick.year}). ${pick.tagline}`,
    [
      {
        kind: 'list',
        items: (pool.length ? pool : MOVIES).slice(0, 4).map<ListItem>((m) => ({
          primary: m.title,
          secondary: `${m.genre} · ${m.year}`,
          trailing: `★ ${m.rating.toFixed(1)}`,
          tone: 'violet',
        })),
      },
    ],
    [{ label: 'Entertainment öffnen', view: 'movies' }],
  )
}

function watchlistAnswer(ctx: BrainContext): JarvisAnswer {
  if (!ctx.watchlist.length) {
    return answer(
      'Deine Merkliste ist noch leer. Im Entertainment-Modul liegt auf jedem Poster oben rechts ein ★ — damit wandert ein Titel hierher.',
      [],
      [{ label: 'Entertainment öffnen', view: 'movies' }],
    )
  }
  const films = ctx.watchlist.filter((e) => e.mediaType === 'movie').length
  const series = ctx.watchlist.length - films
  return answer(
    `Auf der Merkliste stehen ${ctx.watchlist.length} Titel — ${films} Film${films === 1 ? '' : 'e'} und ${series} Serie${series === 1 ? '' : 'n'}.`,
    [
      {
        kind: 'list',
        items: ctx.watchlist.slice(0, 8).map<ListItem>((e) => ({
          primary: e.title,
          secondary: `${e.mediaType === 'tv' ? 'Serie' : 'Film'}${e.year ? ` · ${e.year}` : ''}`,
          trailing: e.rating ? `★ ${e.rating.toFixed(1)}` : undefined,
          tone: 'amber',
        })),
      },
    ],
    [{ label: 'Merkliste öffnen', view: 'movies' }],
  )
}

function flightAnswer(ctx: BrainContext): JarvisAnswer {
  if (ctx.phase === 'arrived') {
    const back = daysHours(TRIP.returnFlight)
    return answer(
      `Du bist in Marmaris. Der Rückflug geht am ${dateTime(TRIP.returnFlight)} — noch ${back.days} Tage und ${back.hours} Stunden.`,
      [
        {
          kind: 'stats',
          rows: [
            { label: 'PHASE', value: PHASE_LABEL[ctx.phase], tone: 'lime' },
            { label: 'RÜCKFLUG', value: dateTime(TRIP.returnFlight), tone: 'amber' },
          ],
        },
      ],
      [{ label: 'Reise öffnen', view: 'travel' }],
    )
  }
  if (ctx.phase === 'returned') {
    return answer('Die Reise ist archiviert. Der nächste Trip steht noch nicht im System.', [], [
      { label: 'Reise öffnen', view: 'travel' },
    ])
  }

  const c = daysHours(TRIP.departure)
  const flightHours = Math.round((TRIP.arrival.getTime() - TRIP.departure.getTime()) / 3_600_000)
  return answer(
    ctx.phase === 'in_flight'
      ? `Du bist gerade in der Luft mit ${TRIP.flightNumber}. Landung in Dalaman um ${clock(TRIP.arrival)} Ortszeit.`
      : `${TRIP.flightNumber} geht am ${dateTime(TRIP.departure)} ab ${ORIGIN.city} — das sind noch ${c.days} Tage, ${c.hours} Stunden und ${c.minutes} Minuten.`,
    [
      {
        kind: 'stats',
        rows: [
          { label: 'ABFLUG', value: dateTime(TRIP.departure), tone: 'amber' },
          { label: 'ANKUNFT', value: dateTime(TRIP.arrival), tone: 'lime' },
          { label: 'GATE', value: `${TRIP.gate} · T${TRIP.terminal}` },
          { label: 'SITZ', value: TRIP.seat },
          { label: 'DISTANZ', value: `${nf.format(TRIP.distanceKm)} km` },
          { label: 'FLUGZEIT', value: `ca. ${flightHours} h` },
        ],
      },
    ],
    [{ label: 'Reise öffnen', view: 'travel' }],
  )
}

function marmarisAnswer(ctx: BrainContext): JarvisAnswer {
  const w = currentWeather()
  const c = daysHours(TRIP.departure)
  const top = POIS.slice(0, 5)
  const say =
    ctx.phase === 'arrived'
      ? `Du bist vor Ort — ${w.tempC} °C, Wasser ${w.seaC} °C. ${w.summary} Für heute bieten sich diese Ziele an:`
      : `Marmaris meldet ${w.tempC} °C bei ${w.seaC} °C Wassertemperatur. Bis du da bist, sind es noch ${c.days} Tage. Was auf dich wartet:`

  return answer(
    say,
    [
      {
        kind: 'list',
        title: 'Ziele im Umkreis',
        items: top.map<ListItem>((p) => ({
          primary: p.name,
          secondary: p.note,
          trailing: `${p.distanceKm.toFixed(1)} km`,
          tone: 'lime',
        })),
      },
      {
        kind: 'stats',
        rows: [
          { label: 'LUFT', value: `${w.tempC} °C`, tone: 'amber' },
          { label: 'WASSER', value: `${w.seaC} °C`, tone: 'cyan' },
          { label: 'WIND', value: `${w.windKmh} km/h` },
          { label: 'UV', value: String(w.uv), tone: w.uv >= 8 ? 'danger' : 'lime' },
        ],
      },
    ],
    [{ label: 'Marmaris öffnen', view: 'marmaris' }],
  )
}

function weatherAnswer(): JarvisAnswer {
  const w = currentWeather()
  const days = forecast()
  return answer(
    `Marmaris: ${w.tempC} °C, gefühlt ${w.feelsC} °C, Wasser ${w.seaC} °C, Wind ${w.windKmh} km/h. ${w.summary}`,
    [
      {
        kind: 'list',
        title: 'Die nächsten Tage',
        items: days.map<ListItem>((d) => ({
          primary: d.day,
          secondary: d.condition.toUpperCase(),
          trailing: `${d.hi}° / ${d.lo}°`,
          tone: 'amber',
        })),
      },
    ],
    [{ label: 'Marmaris öffnen', view: 'marmaris' }],
  )
}

async function currencyAnswer(question: string): Promise<JarvisAnswer> {
  const cached = cachedRate()
  const result = await fetchRate()
  const rate = result.ok ? result.rate : (cached ?? result.rate)
  const query = extractAmount(question)

  const rows = [
    { label: '1 EURO', value: formatTry(rate.tryPerEur), tone: 'amber' as const },
    // Two decimals would round a Lira to "0,02 €" and say nothing.
    { label: '1 LIRA', value: `${(1 / rate.tryPerEur).toFixed(4).replace('.', ',')} €`, tone: 'lime' as const },
    { label: 'STAND', value: rate.date },
  ]

  if (query) {
    const converted =
      query.from === 'EUR'
        ? formatTry(eurToTry(query.amount, rate.tryPerEur))
        : formatEur(tryToEur(query.amount, rate.tryPerEur))
    const source = query.from === 'EUR' ? formatEur(query.amount) : formatTry(query.amount)
    return answer(
      `${source} sind ${converted}.`,
      [
        { kind: 'stats', rows },
        ...(result.ok ? [] : [{ kind: 'note' as const, text: result.message, tone: 'amber' as const }]),
      ],
      [{ label: 'Rechner öffnen', view: 'marmaris' }],
    )
  }

  return answer(
    `Ein Euro steht bei ${formatTry(rate.tryPerEur)} (Stand ${rate.date}). Sag mir einfach einen Betrag — „wie viel sind 250 Euro in Lira" — dann rechne ich ihn dir aus.`,
    [
      { kind: 'stats', rows },
      ...(result.ok ? [] : [{ kind: 'note' as const, text: result.message, tone: 'amber' as const }]),
    ],
    [{ label: 'Rechner öffnen', view: 'marmaris' }],
  )
}

function tasksAnswer(ctx: BrainContext): JarvisAnswer {
  if (!ctx.todos.length) {
    return answer('Deine Erinnerungsliste ist leer. Soll ich dir den Reiter aufmachen?', [], [
      { label: 'Erinnerungen öffnen', view: 'tasks' },
    ])
  }
  const done = ctx.todos.length - ctx.openTodos.length
  return answer(
    ctx.openTodos.length
      ? `Offen sind ${ctx.openTodos.length} von ${ctx.todos.length} Einträgen — ${done} hast du schon abgehakt.`
      : `Alles abgehakt: ${ctx.todos.length} von ${ctx.todos.length} erledigt.`,
    ctx.openTodos.length
      ? [
          {
            kind: 'list',
            title: 'Noch offen',
            items: ctx.openTodos.slice(0, 6).map<ListItem>((t) => ({
              primary: t.text,
              tone: 'amber',
            })),
          },
        ]
      : [],
    [{ label: 'Erinnerungen öffnen', view: 'tasks' }],
  )
}

function commsAnswer(ctx: BrainContext): JarvisAnswer {
  return answer(
    ctx.unreadFromTony > 0
      ? `Tony hat ${ctx.unreadFromTony} ungelesene Nachricht${ctx.unreadFromTony === 1 ? '' : 'en'} im privaten Kanal.`
      : 'Der Kanal zu Tony ist aktiv und verschlüsselt. Nichts Ungelesenes.',
    [],
    [{ label: 'Kanal öffnen', view: 'comms' }],
  )
}

function profileAnswer(ctx: BrainContext): JarvisAnswer {
  const p = ctx.profile
  return answer(
    `Deine Akte: ${p.callsign} aus ${p.home}, ${p.club}, aktuell ${p.currentGame}, nächstes Ziel ${p.nextDestination}.`,
    [
      {
        kind: 'stats',
        rows: [
          { label: 'FILME', value: nf.format(p.moviesWatched) },
          { label: 'SERIEN', value: nf.format(p.seriesWatched) },
          { label: 'BJK LIVE', value: String(p.bjkMatches), tone: 'lime' },
          { label: 'REISEN', value: String(p.trips), tone: 'amber' },
          { label: 'MERKLISTE', value: String(ctx.watchlist.length), tone: 'violet' },
          { label: 'MODUS', value: MODE_SPEC[ctx.mode].label, tone: 'cyan' },
        ],
      },
    ],
    [{ label: 'Ali Database öffnen', view: 'profile' }],
  )
}

function modeAnswer(ctx: BrainContext): JarvisAnswer {
  const spec = MODE_SPEC[ctx.mode]
  return answer(
    `${spec.label} ist aktiv — ${spec.hint} ${
      ctx.settings.modeOverride
        ? 'Du hast den Modus fest eingestellt; „AUTO" in den Einstellungen gibt ihn wieder frei.'
        : 'Ich schalte ihn automatisch nach Lage: Flugtag, Spieltag, Nacht.'
    }`,
    [
      {
        kind: 'list',
        title: 'Modi',
        items: (Object.values(MODE_SPEC) as Array<(typeof MODE_SPEC)[JarvisMode]>).map<ListItem>(
          (m) => ({
            primary: `${m.glyph} ${m.label}`,
            secondary: m.hint,
            trailing: m.id === ctx.mode ? 'AKTIV' : undefined,
            tone: m.id === ctx.mode ? 'lime' : 'cyan',
          }),
        ),
      },
    ],
    [{ label: 'Zu den Einstellungen', view: 'settings' }],
  )
}

function systemAnswer(ctx: BrainContext): JarvisAnswer {
  return answer(
    `Alle Kernmodule laufen. CPU-Last ${ctx.stats.cpu} %, Netz ${ctx.stats.network} %, Ping ${ctx.stats.ping} ms. Missionsphase ${PHASE_LABEL[ctx.phase]}, Interface im ${MODE_SPEC[ctx.mode].label}.`,
    [
      {
        kind: 'stats',
        rows: [
          { label: 'CPU', value: `${ctx.stats.cpu} %` },
          { label: 'NETZ', value: `${ctx.stats.network} %`, tone: 'lime' },
          { label: 'PING', value: `${ctx.stats.ping} ms` },
          { label: 'PHASE', value: PHASE_LABEL[ctx.phase], tone: 'amber' },
        ],
      },
    ],
  )
}

function helpAnswer(): JarvisAnswer {
  return answer(
    'Frag mich in normaler Sprache — ich hole die Daten aus dem passenden Modul, ohne dass du es öffnen musst.',
    [
      {
        kind: 'list',
        title: 'Zum Beispiel',
        items: [
          { primary: '„Was läuft heute?"', secondary: 'Das komplette Briefing', tone: 'lime' },
          { primary: '„Wie sind meine Fortnite Stats?"', secondary: 'Siege, K/D, Win-Rate' },
          { primary: '„Wann ist der nächste Cup?"', secondary: 'Turnierfenster für Europa' },
          { primary: '„Wann spielt Beşiktaş?"', secondary: 'Spielplan und Tabellenplatz' },
          { primary: '„Welche Filme sind neu?"', secondary: 'Kinostarts und Angekündigtes' },
          { primary: '„Empfiehl mir einen Actionfilm."', secondary: 'Erst deine Merkliste' },
          { primary: '„Zeig mir meine Watchlist."', secondary: 'Alles Vorgemerkte' },
          { primary: '„Wann geht mein Flug?"', secondary: 'Countdown, Gate, Sitz' },
          { primary: '„Wie viel sind 250 Euro in Lira?"', secondary: 'Tageskurs' },
          { primary: '„Wie ist das Wetter in Marmaris?"', secondary: 'Jetzt und die nächsten Tage' },
        ],
      },
    ],
  )
}

/* -------------------------------------------------------------------------- */
/* Briefing                                                                   */
/* -------------------------------------------------------------------------- */

export async function buildBriefing(ctx: BrainContext): Promise<JarvisAnswer> {
  const [football, fortnite, releases] = await Promise.all([
    ctx.ensure('football'),
    ctx.ensure('fortnite'),
    ctx.settings.tmdbApiKey ? ctx.ensure('releases') : Promise.resolve(null),
  ])
  const player = ctx.settings.fortniteApiKey && ctx.settings.epicName ? await ctx.ensure('player') : null

  const sections: BriefingSection[] = []

  /* --- Beşiktaş */
  const nextMatch = football.data?.next.find((f) => f.kickoff) ?? football.data?.next[0] ?? null
  const ownRow = football.data?.table.find((r) => isBesiktas(r.team)) ?? null
  sections.push({
    glyph: '🦅',
    title: 'BEŞIKTAŞ',
    tone: 'ice',
    lines: nextMatch
      ? [
          `Nächstes Spiel ${nextMatch.kickoff ? relativeDay(nextMatch.kickoff) : 'bald'}.`,
          fixtureLine(nextMatch),
          ...(ownRow ? [`Platz ${ownRow.rank} · ${ownRow.points} Punkte`] : []),
        ]
      : [football.error ?? 'Kein Spiel angesetzt.'],
  })

  /* --- Fortnite */
  const cups = resolveCups(fortnite.data?.cups)
  const cupLine = cups.live.length
    ? `${cups.live[0].name} läuft gerade.`
    : cups.upcoming[0]
      ? `${cups.upcoming[0].name} ${relativeDay(cups.upcoming[0].start)} um ${clock(cups.upcoming[0].start)}.`
      : 'Kein Cup angesetzt.'
  sections.push({
    glyph: '🎮',
    title: 'FORTNITE',
    tone: 'violet',
    lines: [
      player?.data?.overall
        ? `${nf.format(player.data.overall.wins)} Siege · K/D ${player.data.overall.kd.toFixed(2)}`
        : 'Keine Spielerdaten verknüpft.',
      cupLine,
    ],
  })

  /* --- Entertainment */
  const watch = ctx.watchlist.length
  sections.push({
    glyph: '🎬',
    title: 'ENTERTAINMENT',
    tone: 'amber',
    lines: [
      watch ? `${watch} Titel auf der Merkliste.` : 'Merkliste ist leer.',
      releases?.data
        ? `${releases.data.nowPlaying.length} Filme im Kino, ${releases.data.upcoming.length} angekündigt.`
        : 'Offline-Bibliothek aktiv.',
    ],
  })

  /* --- Travel */
  const c = daysHours(TRIP.departure)
  sections.push({
    glyph: '✈️',
    title: 'MARMARIS',
    tone: 'cyan',
    lines: [
      ctx.phase === 'arrived'
        ? `Vor Ort. Rückflug ${relativeDay(TRIP.returnFlight)}.`
        : ctx.phase === 'in_flight'
          ? `In der Luft. Landung ${clock(TRIP.arrival)} Ortszeit.`
          : `Abflug in ${c.days} Tagen ${c.hours} Stunden.`,
      `${TRIP.flightNumber} · ${ORIGIN.code} → ${DESTINATION.code}`,
    ],
  })

  /* --- Weather */
  const w = currentWeather()
  sections.push({
    glyph: '🌤️',
    title: 'WETTER',
    tone: 'lime',
    lines: [`Marmaris ${w.tempC} °C · Wasser ${w.seaC} °C`, w.summary],
  })

  /* --- Tasks & comms */
  sections.push({
    glyph: '💬',
    title: 'KANÄLE & LISTEN',
    tone: 'violet',
    lines: [
      ctx.unreadFromTony
        ? `${ctx.unreadFromTony} ungelesene Nachricht${ctx.unreadFromTony === 1 ? '' : 'en'} von Tony.`
        : 'Keine ungelesenen Nachrichten.',
      ctx.openTodos.length
        ? `${ctx.openTodos.length} offene Erinnerung${ctx.openTodos.length === 1 ? '' : 'en'}.`
        : 'Erinnerungsliste abgearbeitet.',
    ],
  })

  const alerts = [
    football.status === 'error' ? 'Sportdaten' : null,
    fortnite.status === 'error' ? 'Fortnite' : null,
    releases?.status === 'error' ? 'TMDB' : null,
  ].filter(Boolean)

  return answer(
    'Hier ist dein Briefing, Ali.',
    [
      {
        kind: 'briefing',
        sections,
        footer: alerts.length
          ? `TEILWEISE OFFLINE — ${alerts.join(', ')} nicht erreichbar`
          : 'ALL SYSTEMS OPERATIONAL',
      },
    ],
    [
      { label: 'Beşiktaş', view: 'besiktas' },
      { label: 'Fortnite', view: 'fortnite' },
      { label: 'Reise', view: 'travel' },
    ],
    ['football', 'fortnite', 'releases'],
  )
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export async function respond(question: string, ctx: BrainContext): Promise<JarvisAnswer> {
  const intent: Intent = resolveIntent(question)

  switch (intent) {
    case 'briefing':
      return buildBriefing(ctx)
    case 'fortnite_stats':
      return fortniteStats(ctx)
    case 'fortnite_cups':
      return fortniteCups(ctx)
    case 'fortnite_training':
      return fortniteTraining(ctx)
    case 'besiktas':
      return besiktas(ctx)
    case 'movies_new':
      return moviesNew(ctx, false)
    case 'series':
      return moviesNew(ctx, true)
    case 'movies_recommend':
      return recommend(ctx, question)
    case 'watchlist':
      return watchlistAnswer(ctx)
    case 'flight':
      return flightAnswer(ctx)
    case 'marmaris':
      return marmarisAnswer(ctx)
    case 'weather':
      return weatherAnswer()
    case 'currency':
      return currencyAnswer(question)
    case 'tasks':
      return tasksAnswer(ctx)
    case 'comms':
      return commsAnswer(ctx)
    case 'profile':
      return profileAnswer(ctx)
    case 'mode':
      return modeAnswer(ctx)
    case 'system':
      return systemAnswer(ctx)
    case 'help':
      return helpAnswer()
    case 'greeting':
      return answer(
        `${MODE_SPEC[ctx.mode].greeting} ${
          ctx.phase === 'arrived'
            ? 'Holiday Mode läuft — genieß Marmaris.'
            : `Noch ${daysHours(TRIP.departure).days} Tage bis zum Abflug.`
        } Sag „was läuft heute" für das komplette Briefing.`,
      )
    case 'thanks':
      return answer('Immer zu Diensten, Ali. Ich bleibe im Hintergrund aktiv.')
    default:
      return answer(
        `Das habe ich nicht sicher zuordnen können: „${question.trim()}". Ich kann Beşiktaş, Fortnite, Filme und Serien, deine Merkliste, Reise und Marmaris, Wetter, Währung, Erinnerungen und den Kanal zu Tony abfragen — sag „Hilfe" für die Liste.`,
        [],
        [{ label: 'Was kannst du?', view: '' }],
      )
  }
}

/** Status lines shown while an answer is being assembled. */
export const PROCESS_STEPS = [
  'ANFRAGE WIRD GELESEN...',
  'MODULE WERDEN ABGEFRAGT...',
  'ANTWORT WIRD ZUSAMMENGESETZT...',
]
