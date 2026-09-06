/**
 * Euro ↔ Türkische Lira.
 *
 * Rates come from frankfurter.app, which republishes the ECB reference rates:
 * free, no key, no rate limit, CORS-enabled. The last good rate is cached in
 * localStorage so the converter still works offline (clearly labelled as of
 * its date), and a manual rate can override it entirely.
 */

const ENDPOINT = 'https://api.frankfurter.app/latest?from=EUR&to=TRY'
const CACHE_KEY = 'ronaljarvis.fx.v1'

export interface FxRate {
  /** How many Lira one Euro buys. */
  tryPerEur: number
  /** Date the rate was published (ECB publishes once per working day). */
  date: string
  source: 'live' | 'cache' | 'manual'
  fetchedAt: number
}

/**
 * Last resort so the panel is never empty on a first visit without network.
 * Deliberately round — it is labelled as an estimate wherever it is shown.
 */
export const FALLBACK_RATE = 47

function readCache(): FxRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FxRate>
    if (typeof parsed.tryPerEur !== 'number' || !Number.isFinite(parsed.tryPerEur)) return null
    return {
      tryPerEur: parsed.tryPerEur,
      date: typeof parsed.date === 'string' ? parsed.date : '—',
      source: parsed.source === 'manual' ? 'manual' : 'cache',
      fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    }
  } catch {
    return null
  }
}

function writeCache(rate: FxRate): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rate))
  } catch {
    /* storage unavailable — the rate just won't survive a reload */
  }
}

export function cachedRate(): FxRate | null {
  return readCache()
}

export function saveManualRate(tryPerEur: number): FxRate {
  const rate: FxRate = {
    tryPerEur,
    date: new Date().toISOString().slice(0, 10),
    source: 'manual',
    fetchedAt: Date.now(),
  }
  writeCache(rate)
  return rate
}

export type FxResult =
  | { ok: true; rate: FxRate }
  | { ok: false; message: string; rate: FxRate }

/**
 * Always resolves with *some* rate so the UI can convert immediately; `ok`
 * says whether it is today's published one or a stand-in.
 */
export async function fetchRate(): Promise<FxResult> {
  const cached = readCache()
  try {
    const response = await fetch(ENDPOINT)
    if (!response.ok) throw new Error(String(response.status))
    const body = (await response.json()) as { date?: string; rates?: Record<string, number> }
    const value = body.rates?.TRY
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error('no TRY rate')
    }
    const rate: FxRate = {
      tryPerEur: value,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      source: 'live',
      fetchedAt: Date.now(),
    }
    writeCache(rate)
    return { ok: true, rate }
  } catch {
    return {
      ok: false,
      message: cached
        ? 'Kurs-Server nicht erreichbar — gespeicherter Kurs wird verwendet.'
        : 'Kurs-Server nicht erreichbar — Näherungswert wird verwendet.',
      rate:
        cached ??
        { tryPerEur: FALLBACK_RATE, date: '—', source: 'cache', fetchedAt: 0 },
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Conversion                                                                 */
/* -------------------------------------------------------------------------- */

export const eurToTry = (eur: number, rate: number) => eur * rate
export const tryToEur = (lira: number, rate: number) => lira / rate

const EUR_FMT = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TRY_FMT = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatEur = (n: number) => `${EUR_FMT.format(n)} €`
export const formatTry = (n: number) => `${TRY_FMT.format(n)} ₺`

/**
 * Accepts what a person actually types: "12,50", "1.200,00", "1200.5".
 * Returns null for anything that isn't a number.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/\s|€|₺|TL/gi, '')
  if (!cleaned) return null
  // German notation when a comma is present: dots are thousands separators.
  const normalised = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** Everyday amounts a holidaymaker actually converts. */
export const QUICK_EUR = [5, 10, 20, 50, 100, 250]
