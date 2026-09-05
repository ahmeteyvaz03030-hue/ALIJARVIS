/**
 * Illustrative Cup calendar.
 *
 * Epic doesn't publish a public schedule for competitive Cups/FNCS — that
 * data only exists in-game or behind an authenticated Epic account login,
 * which a static site cannot do. Rather than fake a "live" feed, this uses
 * real Cup formats and a realistic weekly cadence to generate a schedule
 * that always looks current relative to "now". The UI labels it clearly as
 * an example/community calendar, not an official live one.
 */

export interface CupTemplate {
  id: string
  name: string
  format: string
  /** 0 = Sunday … 6 = Saturday, evaluated in UTC. */
  weekday: number
  hourUTC: number
  durationHours: number
  region: string
  prize: string
}

export const CUP_TEMPLATES: CupTemplate[] = [
  {
    id: 'solo-cash',
    name: 'Solo Cash Cup',
    format: 'Solo · Battle Royale',
    weekday: 2,
    hourUTC: 17,
    durationHours: 3,
    region: 'Alle Regionen',
    prize: 'Preisgeld',
  },
  {
    id: 'duo-cash',
    name: 'Duo Cash Cup',
    format: 'Duos · Battle Royale',
    weekday: 3,
    hourUTC: 17,
    durationHours: 3,
    region: 'Alle Regionen',
    prize: 'Preisgeld',
  },
  {
    id: 'zb-cup',
    name: 'Zero Build Cup',
    format: 'Solo · Zero Build',
    weekday: 4,
    hourUTC: 17,
    durationHours: 3,
    region: 'Alle Regionen',
    prize: 'Preisgeld',
  },
  {
    id: 'console-cup',
    name: 'Console Cup',
    format: 'Solo · Battle Royale',
    weekday: 1,
    hourUTC: 17,
    durationHours: 3,
    region: 'Konsole',
    prize: 'Preisgeld',
  },
  {
    id: 'ranked-brawl',
    name: 'Ranked Battle Royale Brawl',
    format: 'Squads · Ranked',
    weekday: 6,
    hourUTC: 16,
    durationHours: 4,
    region: 'Alle Regionen',
    prize: 'Ranked-Punkte',
  },
]

export interface CupEvent {
  templateId: string
  name: string
  format: string
  region: string
  prize: string
  start: Date
  end: Date
}

function firstOccurrenceOnOrAfter(template: CupTemplate, from: Date): Date {
  const d = new Date(from)
  d.setUTCHours(template.hourUTC, 0, 0, 0)
  const diff = (template.weekday - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + diff)
  if (d.getTime() < from.getTime()) d.setUTCDate(d.getUTCDate() + 7)
  return d
}

/** Live (running right now) and upcoming occurrences within `weeksAhead`. */
export function getCupSchedule(now: Date = new Date(), weeksAhead = 3): { live: CupEvent[]; upcoming: CupEvent[] } {
  const horizon = now.getTime() + weeksAhead * 7 * 86_400_000
  const events: CupEvent[] = []

  for (const template of CUP_TEMPLATES) {
    // Seed a week back so an occurrence that started yesterday and might
    // still be "live" isn't missed.
    let start = firstOccurrenceOnOrAfter(template, new Date(now.getTime() - 7 * 86_400_000))
    while (start.getTime() < horizon) {
      const end = new Date(start.getTime() + template.durationHours * 3_600_000)
      events.push({
        templateId: template.id,
        name: template.name,
        format: template.format,
        region: template.region,
        prize: template.prize,
        start,
        end,
      })
      start = new Date(start.getTime() + 7 * 86_400_000)
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime())
  const nowMs = now.getTime()
  return {
    live: events.filter((e) => e.start.getTime() <= nowMs && e.end.getTime() >= nowMs),
    upcoming: events.filter((e) => e.start.getTime() > nowMs).slice(0, 6),
  }
}
