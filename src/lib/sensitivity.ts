/**
 * Fortnite sensitivity maths.
 *
 * Fortnite turns the mouse by a fixed number of degrees per count. That
 * constant (0.5555°/count at sensitivity 1.00) is what every sensitivity
 * converter is built on, and it lets three numbers be derived from the two a
 * player actually knows — DPI and in-game sensitivity:
 *
 *   eDPI    how fast the aim is overall, comparable between players
 *   cm/360  how far the mouse travels for a full turn — the number that
 *           decides whether a sensitivity fits the desk, not the player
 */

/** Degrees turned per mouse count at sensitivity 1.00. */
export const FORTNITE_YAW = 0.5555

const CM_PER_INCH = 2.54

/** In-game sensitivity is shown as a percentage; the maths wants the fraction. */
export const toFraction = (percent: number) => percent / 100

export function eDPI(dpi: number, sensPercent: number): number {
  return dpi * sensPercent
}

export function cm360(dpi: number, sensPercent: number): number {
  const counts = FORTNITE_YAW * dpi * toFraction(sensPercent)
  if (counts <= 0) return 0
  return (360 / counts) * CM_PER_INCH
}

export function inches360(dpi: number, sensPercent: number): number {
  return cm360(dpi, sensPercent) / CM_PER_INCH
}

/** The sensitivity that keeps the same cm/360 at a different DPI. */
export function sensForCm360(dpi: number, targetCm: number): number {
  if (dpi <= 0 || targetCm <= 0) return 0
  const inches = targetCm / CM_PER_INCH
  return (360 / (FORTNITE_YAW * dpi * inches)) * 100
}

export interface SensBand {
  id: string
  label: string
  /** Inclusive lower bound in cm/360. */
  from: number
  /** Exclusive upper bound in cm/360. */
  to: number
  blurb: string
  tone: 'danger' | 'amber' | 'lime' | 'cyan' | 'violet'
}

/**
 * Ranges as they are actually played. Nobody is wrong for sitting outside
 * them — they are a starting point, which is exactly what someone looking for
 * a sensitivity needs.
 */
export const BANDS: SensBand[] = [
  {
    id: 'blitz',
    label: 'SEHR SCHNELL',
    from: 0,
    to: 18,
    blurb: 'Baut und dreht extrem schnell, kostet aber Präzision auf Distanz.',
    tone: 'danger',
  },
  {
    id: 'fast',
    label: 'SCHNELL',
    from: 18,
    to: 26,
    blurb: 'Typisch für Build-Fights. Verlangt eine ruhige Hand beim Zielen.',
    tone: 'amber',
  },
  {
    id: 'balanced',
    label: 'AUSGEWOGEN',
    from: 26,
    to: 38,
    blurb: 'Der Bereich, in dem die meisten Fortnite-Profis spielen. Guter Start.',
    tone: 'lime',
  },
  {
    id: 'control',
    label: 'KONTROLLIERT',
    from: 38,
    to: 50,
    blurb: 'Sehr präzise auf Distanz, im Nahkampf musst du mehr Arm einsetzen.',
    tone: 'cyan',
  },
  {
    id: 'slow',
    label: 'SEHR LANGSAM',
    from: 50,
    to: Infinity,
    blurb: 'Braucht viel Platz auf dem Tisch. Für Fortnite meist zu träge.',
    tone: 'violet',
  },
]

export function bandFor(cm: number): SensBand {
  return BANDS.find((b) => cm >= b.from && cm < b.to) ?? BANDS[BANDS.length - 1]
}

/* -------------------------------------------------------------------------- */
/* Flick calibration                                                          */
/* -------------------------------------------------------------------------- */

export interface FlickSample {
  /** Distance the target sat from the crosshair, in pixels. */
  distance: number
  /** Where the shot actually landed relative to the target, along the flick. */
  overshoot: number
}

export interface FlickVerdict {
  /** Mean over/undershoot as a share of the flick distance. Positive = past it. */
  bias: number
  /** Spread of the samples — high means inconsistent rather than mis-tuned. */
  spread: number
  /** Suggested change to the in-game sensitivity, as a percentage of itself. */
  suggestion: number
  headline: string
  detail: string
}

/**
 * Turns a handful of flicks into one recommendation.
 *
 * Consistently landing past the target means the sensitivity moves more than
 * the hand expects; consistently short means the opposite. A wide spread means
 * neither — that is practice, and saying so is more useful than nudging a
 * number that was never the problem.
 */
export function judgeFlicks(samples: FlickSample[]): FlickVerdict | null {
  if (samples.length < 5) return null
  const ratios = samples.map((s) => (s.distance > 0 ? s.overshoot / s.distance : 0))
  const bias = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const variance = ratios.reduce((a, b) => a + (b - bias) ** 2, 0) / ratios.length
  const spread = Math.sqrt(variance)

  if (spread > 0.22) {
    return {
      bias,
      spread,
      suggestion: 0,
      headline: 'Erst Konstanz, dann Sensitivität',
      detail:
        'Deine Flicks streuen stark in beide Richtungen — mal zu weit, mal zu kurz. Das ist kein Sensitivitäts-Problem, sondern Übung. Lass die Einstellung, wie sie ist, und mach ein paar Runden Flick-Training.',
    }
  }

  // Only correct what is clearly systematic; a few percent is noise.
  const suggestion = Math.abs(bias) < 0.06 ? 0 : Math.max(-25, Math.min(25, -bias * 100 * 0.7))

  if (suggestion === 0) {
    return {
      bias,
      spread,
      suggestion: 0,
      headline: 'Deine Sensitivität passt',
      detail:
        'Du landest im Schnitt genau auf dem Ziel. An der Einstellung gibt es nichts zu drehen — ab hier bringt nur noch Training etwas.',
    }
  }

  return bias > 0
    ? {
        bias,
        spread,
        suggestion,
        headline: `Etwas niedriger — rund ${Math.abs(suggestion).toFixed(0)} %`,
        detail: `Du ziehst im Schnitt ${(bias * 100).toFixed(0)} % über das Ziel hinaus. Eine etwas niedrigere Sensitivität fängt genau das ab.`,
      }
    : {
        bias,
        spread,
        suggestion,
        headline: `Etwas höher — rund ${Math.abs(suggestion).toFixed(0)} %`,
        detail: `Du bleibst im Schnitt ${Math.abs(bias * 100).toFixed(0)} % vor dem Ziel stehen. Etwas mehr Sensitivität schließt die Lücke.`,
      }
}

/** Sensitivities worth knowing about when nothing is configured yet. */
export const PRESETS = [
  { name: 'Build-Fokus', dpi: 800, sens: 9.0 },
  { name: 'Ausgewogen', dpi: 800, sens: 7.0 },
  { name: 'Zielen-Fokus', dpi: 800, sens: 5.5 },
  { name: 'Low DPI klassisch', dpi: 400, sens: 14.0 },
  { name: 'High DPI', dpi: 1600, sens: 3.5 },
]
