/**
 * Interface modes.
 *
 * RonalJarvis is not a fixed dashboard — it re-arranges itself around whatever
 * is actually happening. The mode is derived from the situation (flight phase,
 * an imminent Beşiktaş kick-off, the hour of the day) and can be forced from
 * the settings for a look-ahead.
 *
 * A mode changes three things and nothing else: the accent colour, the order
 * of the home dashboard, and the line RonalJarvis leads with. Every module
 * stays reachable in every mode.
 */

import type { FlightPhase } from './config'

export type JarvisMode =
  | 'normal'
  | 'travel'
  | 'matchday'
  | 'gaming'
  | 'cinema'
  | 'night'
  | 'emergency'

export const JARVIS_MODES: JarvisMode[] = [
  'normal',
  'travel',
  'matchday',
  'gaming',
  'cinema',
  'night',
  'emergency',
]

export interface ModeSpec {
  id: JarvisMode
  /** Shown in the top bar. */
  label: string
  /** One line explaining why this mode exists. */
  hint: string
  /** Accent colour as an `r, g, b` triple, applied as a CSS variable. */
  accent: string
  glyph: string
  /** What RonalJarvis leads with when this mode is active. */
  greeting: string
}

export const MODE_SPEC: Record<JarvisMode, ModeSpec> = {
  normal: {
    id: 'normal',
    label: 'NORMAL MODE',
    hint: 'Alle Module gleichberechtigt.',
    accent: '53, 230, 255',
    glyph: '◈',
    greeting: 'Alle Systeme laufen. Wie kann ich helfen, Ali?',
  },
  travel: {
    id: 'travel',
    label: 'TRAVEL MODE',
    hint: 'Flug, Marmaris und Countdown stehen vorn.',
    accent: '255, 181, 77',
    glyph: '✈',
    greeting: 'Reisebetrieb aktiv. Flug und Marmaris habe ich nach vorne geholt.',
  },
  matchday: {
    id: 'matchday',
    label: 'MATCHDAY MODE',
    hint: 'Beşiktaş übernimmt das Dashboard.',
    accent: '235, 240, 245',
    glyph: '🦅',
    greeting: 'Spieltag. Beşiktaş steht oben, alles andere rückt nach.',
  },
  gaming: {
    id: 'gaming',
    label: 'GAMING MODE',
    hint: 'Fortnite-Stats, Cups und Training stehen vorn.',
    accent: '169, 123, 255',
    glyph: '🎮',
    greeting: 'Gaming-Betrieb. Cups, Stats und Aim-Training liegen bereit.',
  },
  cinema: {
    id: 'cinema',
    label: 'CINEMA MODE',
    hint: 'Filme, Serien und die Merkliste stehen vorn.',
    accent: '255, 105, 180',
    glyph: '🎬',
    greeting: 'Kinobetrieb. Merkliste und Neuerscheinungen liegen oben.',
  },
  night: {
    id: 'night',
    label: 'NIGHT MODE',
    hint: 'Gedämpftes HUD, ruhigere Bewegungen.',
    accent: '110, 150, 200',
    glyph: '☾',
    greeting: 'Nachtbetrieb. Ich halte das HUD gedämpft.',
  },
  emergency: {
    id: 'emergency',
    label: 'EMERGENCY MODE',
    hint: 'Notrufnummern, Konsulat und Reisedaten zuerst.',
    accent: '255, 82, 92',
    glyph: '⚠',
    greeting: 'Notfallbetrieb. Kontakte und Reisedaten stehen ganz oben.',
  },
}

/** Card ordering per mode — cards not listed keep their natural order after these. */
export const MODE_PRIORITY: Record<JarvisMode, string[]> = {
  normal: ['watchparty', 'core', 'countdown', 'dialogue', 'briefing', 'channel'],
  travel: ['countdown', 'core', 'briefing', 'weather', 'dialogue'],
  matchday: ['besiktas', 'core', 'dialogue', 'briefing'],
  gaming: ['fortnite', 'core', 'dialogue', 'briefing'],
  cinema: ['watchparty', 'movies', 'channel', 'core', 'dialogue', 'briefing'],
  night: ['core', 'dialogue', 'briefing', 'channel'],
  emergency: ['emergency', 'countdown', 'core'],
}

export interface ModeInput {
  phase: FlightPhase
  /** Hours until the next Beşiktaş kick-off; `null` when none is known. */
  hoursToKickoff: number | null
  /** Local hour, 0–23. */
  hour: number
  override: JarvisMode | null
}

/**
 * Resolution order matters: an override always wins, then a live situation
 * (in the air, kick-off imminent), then the time of day.
 */
export function resolveMode(input: ModeInput): JarvisMode {
  if (input.override) return input.override
  if (input.phase === 'in_flight' || input.phase === 'flight_day') return 'travel'
  if (input.hoursToKickoff !== null && input.hoursToKickoff >= -2.5 && input.hoursToKickoff <= 4) {
    return 'matchday'
  }
  if (input.hour >= 23 || input.hour < 6) return 'night'
  return 'normal'
}

/** Emergency contacts — the one screen that has to work without a network. */
export const EMERGENCY_CONTACTS = [
  { label: 'Notruf Türkei (alle Dienste)', value: '112', hint: 'Polizei, Feuerwehr, Rettung' },
  { label: 'Notruf EU / Deutschland', value: '112', hint: 'Gilt auch aus dem Ausland' },
  { label: 'Touristenpolizei Marmaris', value: '+90 252 412 10 04', hint: 'Englischsprachig' },
  { label: 'Deutsches Generalkonsulat İzmir', value: '+90 232 488 88 88', hint: 'Zuständig für Muğla' },
  { label: 'Auswärtiges Amt Bürgerservice', value: '+49 30 1817 2000', hint: '24/7 aus dem Ausland' },
  { label: 'Kartensperre weltweit', value: '+49 116 116', hint: 'Bank- und Kreditkarten sperren' },
]
