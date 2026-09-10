/**
 * The owner channel — messages Ahmet sends that reach Ali as RonalJarvis.
 *
 * This is a static site with no server behind it, so "live" has to be built
 * out of things a static site actually has. Three routes carry a message, and
 * they layer:
 *
 *   1. `comms.json` next to the build. The owner drops a message in, pushes,
 *      Pages redeploys, and every device picks it up on its next poll. This is
 *      the always-on route.
 *   2. A share link (`#rjv=…`). The owner writes a message, copies the link
 *      and sends it over WhatsApp — Ali opens it and the message is there in
 *      seconds, no deploy. This is the instant route.
 *   3. Locally, on the owner's own device, for writing and previewing.
 *
 * All three produce the same message objects, merged by id. Swapping in a real
 * backend later means replacing `fetchRemoteFeed` — nothing else changes.
 */

export type OwnerKind = 'message' | 'watchparty' | 'cinema'

export interface OwnerFilm {
  title: string
  year?: number
  tmdbId?: number
  posterUrl?: string | null
  /** YouTube key, so the trailer plays inside the app. */
  trailerKey?: string | null
  overview?: string
}

export interface OwnerEvent {
  /** Epoch milliseconds — the countdown reads from this. */
  startsAt: number
  /** "Discord", "Capitol Plauen · Saal 3", "bei Tony auf der Terrasse". */
  place: string
  note?: string
  /** Row and seat, for a real cinema booking. */
  seat?: string
  price?: string
}

export interface OwnerMessage {
  id: string
  /** When the owner wrote it. */
  at: number
  kind: OwnerKind
  text: string
  film?: OwnerFilm
  event?: OwnerEvent
  /** A recorded voice note as a data: URL — the owner's real voice. */
  voice?: string
  /** Set on replies Ali composes back. */
  from?: 'owner' | 'ali'
}

export const FEED_FILE = 'comms.json'

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/** Hand-edited JSON is the normal case here, so every field is optional. */
export function parseMessage(raw: unknown): OwnerMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const text = str(r.text) ?? ''
  const kindRaw = str(r.kind)
  const kind: OwnerKind =
    kindRaw === 'watchparty' || kindRaw === 'cinema' ? kindRaw : 'message'
  const id = str(r.id) ?? `${kind}-${num(r.at) ?? 0}-${text.slice(0, 12)}`
  if (!text && !r.film && !r.voice) return null

  const filmRaw = r.film as Record<string, unknown> | undefined
  const film: OwnerFilm | undefined =
    filmRaw && str(filmRaw.title)
      ? {
          title: str(filmRaw.title) as string,
          year: num(filmRaw.year),
          tmdbId: num(filmRaw.tmdbId),
          posterUrl: str(filmRaw.posterUrl) ?? null,
          trailerKey: str(filmRaw.trailerKey) ?? null,
          overview: str(filmRaw.overview),
        }
      : undefined

  const eventRaw = r.event as Record<string, unknown> | undefined
  const startsAt = eventRaw
    ? (num(eventRaw.startsAt) ?? (str(eventRaw.startsAt) ? Date.parse(str(eventRaw.startsAt) as string) : undefined))
    : undefined
  const event: OwnerEvent | undefined =
    eventRaw && startsAt !== undefined && Number.isFinite(startsAt)
      ? {
          startsAt,
          place: str(eventRaw.place) ?? '',
          note: str(eventRaw.note),
          seat: str(eventRaw.seat),
          price: str(eventRaw.price),
        }
      : undefined

  return {
    id,
    at: num(r.at) ?? (str(r.at) ? Date.parse(str(r.at) as string) : Date.now()),
    kind,
    text,
    film,
    event,
    voice: str(r.voice),
    from: str(r.from) === 'ali' ? 'ali' : 'owner',
  }
}

export function parseFeed(raw: unknown): OwnerMessage[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { messages?: unknown }).messages)
      ? ((raw as { messages: unknown[] }).messages)
      : []
  return list.map(parseMessage).filter((m): m is OwnerMessage => m !== null)
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

/** Where the feed lives relative to the deployed app. */
export function feedUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}${FEED_FILE}`
}

export interface FeedResult {
  messages: OwnerMessage[]
  /** `false` when the file is simply not deployed — not an error worth showing. */
  reachable: boolean
}

export async function fetchRemoteFeed(): Promise<FeedResult> {
  try {
    // `cache: 'no-store'` matters: this file is the whole point of polling.
    const response = await fetch(`${feedUrl()}?t=${Math.floor(Date.now() / 30_000)}`, {
      cache: 'no-store',
    })
    if (!response.ok) return { messages: [], reachable: false }
    const body = (await response.json()) as unknown
    return { messages: parseFeed(body), reachable: true }
  } catch {
    return { messages: [], reachable: false }
  }
}

/* -------------------------------------------------------------------------- */
/* Share links                                                                */
/* -------------------------------------------------------------------------- */

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export function encodeMessages(messages: OwnerMessage[]): string {
  const json = JSON.stringify(messages)
  return toBase64Url(new TextEncoder().encode(json))
}

export function decodeMessages(encoded: string): OwnerMessage[] {
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    return parseFeed(JSON.parse(json) as unknown)
  } catch {
    return []
  }
}

export const SHARE_PREFIX = 'rjv='

export function shareLink(messages: OwnerMessage[], origin = window.location.href): string {
  const url = new URL(origin)
  url.hash = SHARE_PREFIX + encodeMessages(messages)
  return url.toString()
}

/** Pulls a shared message out of the address bar and clears it again. */
export function takeSharedFromLocation(): OwnerMessage[] {
  if (typeof window === 'undefined') return []
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith(SHARE_PREFIX)) return []
  const messages = decodeMessages(hash.slice(SHARE_PREFIX.length))
  // Leave the URL clean so a reload doesn't look like a second delivery.
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* ignore */
  }
  return messages
}

/* -------------------------------------------------------------------------- */
/* Composing                                                                  */
/* -------------------------------------------------------------------------- */

export function newId(kind: OwnerKind): string {
  const rand =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10)
  return `${kind}-${Date.now().toString(36)}-${rand}`
}

/** Pretty JSON for pasting into `public/comms.json`. */
export function toFeedJson(messages: OwnerMessage[]): string {
  return JSON.stringify({ messages }, null, 2)
}
