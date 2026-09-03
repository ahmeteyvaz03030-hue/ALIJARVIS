import { DESTINATION, ORIGIN, PHASE_LABEL, TRIP, type FlightPhase } from './config'
import { currentWeather } from '../data/weather'
import { MOVIES } from '../data/movies'

export interface BrainContext {
  phase: FlightPhase
  daysToFlight: number
  hoursToFlight: number
  cpu: number
  network: number
  unreadFromTony: number
}

interface Rule {
  match: RegExp
  answer: (ctx: BrainContext) => string
}

const fmt = (n: number) => n.toLocaleString('de-DE')

/**
 * The demo brain: deterministic, context-aware canned answers. It reads the
 * same live state the HUD does, so replies stay consistent with the panels.
 *
 * To go live later, replace `respond()` with a call to a model endpoint — the
 * chat component only needs a string back.
 */
const RULES: Rule[] = [
  {
    match: /(countdown|wie lange|wann geht|abflug|wie viele tage|noch bis)/i,
    answer: (c) =>
      c.phase === 'arrived'
        ? `Du bist bereits in Marmaris, Ali. Die Rückreise ist für den ${TRIP.returnFlight.toLocaleDateString('de-DE')} geplant.`
        : `Bis zum Abflug ${TRIP.flightNumber} verbleiben ${c.daysToFlight} Tage und ${c.hoursToFlight} Stunden. Abflug ${TRIP.departure.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} in ${ORIGIN.city}.`,
  },
  {
    match: /(wetter|temperatur|regen|sonne|meer|baden)/i,
    answer: () => {
      const w = currentWeather()
      return `Marmaris meldet ${w.tempC}°C, Wassertemperatur ${w.seaC}°C, Wind ${w.windKmh} km/h. ${w.summary}`
    },
  },
  {
    match: /(flug|route|distanz|kilometer|entfernung|dalaman|landung)/i,
    answer: () =>
      `Route ${ORIGIN.code} → ${TRIP.flightNumber} → DLM. Distanz ${fmt(TRIP.distanceKm)} km, Reiseflughöhe ${fmt(TRIP.cruiseAltitudeFt)} ft, Reisegeschwindigkeit ${fmt(TRIP.cruiseSpeedKmh)} km/h. Landung ${TRIP.arrival.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} Ortszeit.`,
  },
  {
    match: /(film|movie|kino|serie|schauen|trailer)/i,
    answer: () => {
      const ready = MOVIES.filter((m) => m.status === 'DOWNLOADED')
      return `Die Entertainment-Datenbank hält ${MOVIES.length} Titel bereit, ${ready.length} davon offline verfügbar: ${ready.map((m) => m.title).join(', ')}. Meine Empfehlung für den Flug: ${ready[0]?.title ?? MOVIES[0].title}.`
    },
  },
  {
    match: /(tony|nachricht|chat|kontakt)/i,
    answer: (c) =>
      c.unreadFromTony > 0
        ? `Tony hat ${c.unreadFromTony} ungelesene Nachricht(en) im privaten Kanal hinterlassen. Soll ich den Kanal öffnen?`
        : 'Der private Kanal zu Tony ist aktiv und verschlüsselt. Keine ungelesenen Nachrichten.',
  },
  {
    match: /(marmaris|sehenswürdig|strand|bucht|ausflug|was kann man)/i,
    answer: () =>
      `Marmaris liegt bei ${DESTINATION.lat.toFixed(2)}°N / ${DESTINATION.lon.toFixed(2)}°E. Top-Ziele im Radar: Marmaris Kalesi, İçmeler Beach, Turunç Bay, Paradise Island und der Sunset Point über der Bucht. Der Bootstransfer nach Turunç dauert 25 Minuten.`,
  },
  {
    match: /(system|status|cpu|netzwerk|performance|läuft)/i,
    answer: (c) =>
      `Alle Kernmodule sind online. CPU-Last ${c.cpu}%, Netzverfügbarkeit ${c.network}%, Missionsphase ${PHASE_LABEL[c.phase]}. Keine Anomalien im letzten Scan.`,
  },
  {
    match: /(hilfe|help|was kannst du|befehle|kommandos)/i,
    answer: () =>
      'Ich kann Countdown, Flugroute, Wetter in Marmaris, die Filmdatenbank, den Tony-Kanal und den Systemstatus abfragen. Frag einfach in normaler Sprache — zum Beispiel „Wie lange noch bis zum Abflug?“ oder „Wie ist das Wetter in Marmaris?“.',
  },
  {
    match: /(hallo|hi|hey|guten (morgen|tag|abend)|selam|moin)/i,
    answer: (c) =>
      `Willkommen zurück, Ali. Alle Systeme laufen. ${
        c.phase === 'arrived'
          ? 'Holiday Mode ist aktiv — genieß Marmaris.'
          : `Noch ${c.daysToFlight} Tage bis zum Abflug.`
      }`,
  },
  {
    match: /(danke|thx|super|nice)/i,
    answer: () => 'Immer zu Diensten, Ali. Ich bleibe im Hintergrund aktiv.',
  },
]

export function respond(question: string, ctx: BrainContext): string {
  for (const rule of RULES) {
    if (rule.match.test(question)) return rule.answer(ctx)
  }
  return `Anfrage protokolliert: „${question.trim()}“. Für diese Demo sind meine Wissensmodule auf Reise, Marmaris, Entertainment, Tony-Comms und Systemstatus begrenzt. Frag mich etwas daraus — oder sag „Hilfe“ für die Übersicht.`
}

/** Short status line RonalJarvis shows above the answer while it thinks. */
export const PROCESS_STEPS = [
  'PROCESSING REQUEST...',
  'QUERYING KNOWLEDGE MODULES...',
  'COMPOSING RESPONSE...',
]
