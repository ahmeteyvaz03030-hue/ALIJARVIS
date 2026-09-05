/**
 * Cup calendar.
 *
 * Epic publishes no open schedule for competitive Cups — the real one lives
 * in-game or behind an authenticated Epic account, which a static site cannot
 * reach. So this is a *generated* calendar built from the Cup formats that
 * actually run (Solo Victory Cup, the Reload Ranked Cups, Console Victory
 * Cup, Cash Cups, FNCS) on the weekly rhythm they actually follow, with real
 * per-region start offsets. It is labelled as an estimate everywhere it is
 * shown, and it is not presented as live data.
 */

export type Region = 'EU' | 'NAC' | 'NAW' | 'BR' | 'ASIA' | 'OCE' | 'ME'

export const REGIONS: Region[] = ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME']

export const REGION_LABEL: Record<Region, string> = {
  EU: 'Europa',
  NAC: 'NA Central',
  NAW: 'NA West',
  BR: 'Brasilien',
  ASIA: 'Asien',
  OCE: 'Ozeanien',
  ME: 'Naher Osten',
}

/**
 * Hour (UTC) each region typically starts its cup block on a given day.
 * Asia/Oceania run first, Europe mid-afternoon, the Americas in the evening —
 * which is why a cup can be live in one region and hours away in another.
 */
const REGION_START_UTC: Record<Region, number> = {
  OCE: 7,
  ASIA: 9,
  EU: 12, // 14:00 in Marmaris-adjacent CEST — the slot Ali actually sees
  ME: 14,
  BR: 19,
  NAC: 21,
  NAW: 23,
}

export interface CupTemplate {
  id: string
  name: string
  format: string
  /** 0 = Sunday … 6 = Saturday, in UTC. */
  weekday: number
  durationHours: number
  prize: string
  /** Regions this format runs in. */
  regions: Region[]
  /** Hours after the region's first slot. Two cups on the same day don't
   *  start together — the later one runs after the first block. */
  hourOffset?: number
}

export const CUP_TEMPLATES: CupTemplate[] = [
  {
    id: 'solo-victory',
    name: 'Solo Victory Cup',
    format: 'Solo · Battle Royale',
    weekday: 5,
    durationHours: 3,
    prize: 'Victory Umbrella',
    regions: REGIONS,
  },
  {
    id: 'duos-reload-br',
    name: 'Duos Reload Ranked Cup',
    format: 'Duos · Battle Royale',
    weekday: 6,
    durationHours: 3,
    prize: 'Ranked-Belohnungen',
    regions: REGIONS,
  },
  {
    id: 'duos-reload-zb',
    name: 'Duos Reload Ranked Cup',
    format: 'Duos · Zero Build',
    weekday: 6,
    durationHours: 3,
    prize: 'Ranked-Belohnungen',
    regions: REGIONS,
    hourOffset: 4,
  },
  {
    id: 'console-zb-solo',
    name: 'Console Zero Build Solo Victory Cup',
    format: 'Solo · Zero Build · Konsole',
    weekday: 0,
    durationHours: 3,
    prize: 'Victory Umbrella',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'OCE'],
  },
  {
    id: 'solo-cash',
    name: 'Solo Cash Cup',
    format: 'Solo · Battle Royale',
    weekday: 2,
    durationHours: 3,
    prize: 'Preisgeld',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'],
  },
  {
    id: 'duo-cash',
    name: 'Duos Cash Cup',
    format: 'Duos · Battle Royale',
    weekday: 3,
    durationHours: 3,
    prize: 'Preisgeld',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'],
  },
  {
    id: 'zb-cash',
    name: 'Zero Build Cash Cup',
    format: 'Solo · Zero Build',
    weekday: 4,
    durationHours: 3,
    prize: 'Preisgeld',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'OCE'],
  },
  {
    id: 'ranked-brawl',
    name: 'Ranked Battle Royale Brawl',
    format: 'Squads · Ranked',
    weekday: 1,
    durationHours: 4,
    prize: 'Ranked-Punkte',
    regions: REGIONS,
  },
  {
    id: 'fncs-divisional',
    name: 'FNCS Divisional Cup',
    format: 'Trios · Battle Royale',
    weekday: 6,
    durationHours: 4,
    prize: 'FNCS-Punkte',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'],
    hourOffset: 8,
  },
  {
    id: 'trio-cash',
    name: 'Trios Cash Cup',
    format: 'Trios · Battle Royale',
    weekday: 4,
    durationHours: 3,
    prize: 'Preisgeld',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'ASIA', 'OCE', 'ME'],
    hourOffset: 4,
  },
  {
    id: 'zb-duo-cash',
    name: 'Zero Build Duos Cash Cup',
    format: 'Duos · Zero Build',
    weekday: 3,
    durationHours: 3,
    prize: 'Preisgeld',
    regions: ['EU', 'NAC', 'NAW', 'BR', 'OCE'],
    hourOffset: 4,
  },
  {
    id: 'solo-victory-late',
    name: 'Solo Victory Cup',
    format: 'Solo · Battle Royale · Spätblock',
    weekday: 5,
    durationHours: 3,
    prize: 'Victory Umbrella',
    regions: REGIONS,
    hourOffset: 4,
  },
  {
    id: 'reload-quick',
    name: 'Reload Quick Cup',
    format: 'Solo · Reload',
    weekday: 0,
    durationHours: 3,
    prize: 'Ranked-Belohnungen',
    regions: REGIONS,
    hourOffset: 4,
  },
]

export interface CupEvent {
  id: string
  templateId: string
  name: string
  format: string
  region: Region
  prize: string
  start: Date
  end: Date
}

function occurrenceOnOrAfter(weekday: number, hourUTC: number, from: Date): Date {
  const d = new Date(from)
  d.setUTCHours(hourUTC % 24, 0, 0, 0)
  if (hourUTC >= 24) d.setUTCDate(d.getUTCDate() + 1)
  const diff = (weekday - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + diff)
  if (d.getTime() < from.getTime()) d.setUTCDate(d.getUTCDate() + 7)
  return d
}

export interface Schedule {
  live: CupEvent[]
  upcoming: CupEvent[]
}

/**
 * @param regions which regions to include — defaults to Europe, the one that
 *                matters for a player flying out of Germany.
 */
export function getCupSchedule(
  now: Date = new Date(),
  regions: Region[] = ['EU'],
  weeksAhead = 2,
): Schedule {
  const horizon = now.getTime() + weeksAhead * 7 * 86_400_000
  const events: CupEvent[] = []

  for (const template of CUP_TEMPLATES) {
    for (const region of template.regions) {
      if (!regions.includes(region)) continue
      let start = occurrenceOnOrAfter(
        template.weekday,
        REGION_START_UTC[region] + (template.hourOffset ?? 0),
        new Date(now.getTime() - 7 * 86_400_000),
      )
      while (start.getTime() < horizon) {
        const end = new Date(start.getTime() + template.durationHours * 3_600_000)
        events.push({
          id: `${template.id}-${region}-${start.getTime()}`,
          templateId: template.id,
          name: template.name,
          format: template.format,
          region,
          prize: template.prize,
          start,
          end,
        })
        start = new Date(start.getTime() + 7 * 86_400_000)
      }
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime())
  const nowMs = now.getTime()
  return {
    live: events.filter((e) => e.start.getTime() <= nowMs && e.end.getTime() >= nowMs),
    upcoming: events.filter((e) => e.start.getTime() > nowMs).slice(0, 40),
  }
}
