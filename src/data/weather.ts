export type Condition = 'sun' | 'clouds' | 'rain' | 'storm' | 'night'

export interface WeatherNow {
  condition: Condition
  tempC: number
  feelsC: number
  humidity: number
  windKmh: number
  seaC: number
  uv: number
  summary: string
}

export interface ForecastDay {
  day: string
  condition: Condition
  hi: number
  lo: number
}

export const CONDITION_LABEL: Record<Condition, string> = {
  sun: 'SONNIG',
  clouds: 'BEWÖLKT',
  rain: 'REGEN',
  storm: 'GEWITTER',
  night: 'KLARE NACHT',
}

/**
 * Demo weather for Marmaris. Deterministic per day so the panel is stable
 * across reloads, with a slow drift on the live values.
 */
const BASE: Array<{ condition: Condition; hi: number; lo: number }> = [
  { condition: 'sun', hi: 33, lo: 24 },
  { condition: 'sun', hi: 34, lo: 25 },
  { condition: 'clouds', hi: 31, lo: 24 },
  { condition: 'sun', hi: 32, lo: 23 },
  { condition: 'rain', hi: 28, lo: 22 },
  { condition: 'sun', hi: 31, lo: 23 },
  { condition: 'sun', hi: 33, lo: 24 },
]

const DAY_NAMES = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA']

export function forecast(from = new Date()): ForecastDay[] {
  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(from.getTime() + i * 86_400_000)
    const spec = BASE[(date.getDate() + i) % BASE.length]
    return { day: i === 0 ? 'HEUTE' : DAY_NAMES[date.getDay()], ...spec }
  })
}

export function currentWeather(condition?: Condition, at = new Date()): WeatherNow {
  const hour = at.getHours()
  const resolved: Condition =
    condition ?? (hour >= 21 || hour < 6 ? 'night' : forecast(at)[0].condition)
  const base = forecast(at)[0]
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
  const temp = Math.round(base.lo + (base.hi - base.lo) * daylight)

  const summaries: Record<Condition, string> = {
    sun: 'Klarer Himmel über der Bucht — perfekt für den Strand.',
    clouds: 'Leichte Wolkendecke, angenehm warm.',
    rain: 'Kurze Schauer über der Küste, danach wieder trocken.',
    storm: 'Gewitterzellen über dem Golf von Gökova.',
    night: 'Sternenklar, warme Brise vom Meer.',
  }

  return {
    condition: resolved,
    tempC: temp,
    feelsC: temp + (resolved === 'sun' ? 2 : 0),
    humidity: resolved === 'rain' || resolved === 'storm' ? 78 : 54,
    windKmh: resolved === 'storm' ? 42 : 14,
    seaC: 27,
    uv: resolved === 'sun' ? 9 : resolved === 'clouds' ? 5 : 2,
    summary: summaries[resolved],
  }
}
