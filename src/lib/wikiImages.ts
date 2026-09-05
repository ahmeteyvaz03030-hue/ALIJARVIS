/**
 * Real landmark photos via Wikipedia's public REST summary API — no key,
 * no registration, CORS-enabled, and legally fine to hotlink (Wikimedia
 * explicitly serves these thumbnails for exactly this kind of use).
 *
 * Every place tries a short list of candidate article titles across Turkish
 * and English Wikipedia; the first one with a lead image wins. Anything that
 * fails (no article, no image, offline) resolves to `null` so the caller can
 * fall back to the procedural HUD look — this must never block the view.
 */

export interface WikiImage {
  url: string
  width: number
  height: number
  /** Link back to the source article, shown as a small credit. */
  pageUrl: string
  title: string
}

interface WikiSummary {
  title: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string } }
}

const cache = new Map<string, Promise<WikiImage | null>>()

async function fetchSummary(lang: string, title: string): Promise<WikiImage | null> {
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { accept: 'application/json' } },
    )
    if (!response.ok) return null
    const data = (await response.json()) as WikiSummary
    const image = data.thumbnail ?? data.originalimage
    if (!image) return null
    return {
      url: image.source,
      width: image.width,
      height: image.height,
      pageUrl: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      title: data.title,
    }
  } catch {
    return null
  }
}

/**
 * Tries each `{lang, title}` candidate in order and returns the first real
 * photo found. Results (including "nothing found") are cached in-memory for
 * the session so re-mounting a card never re-fetches.
 */
export function getLandmarkImage(candidates: Array<{ lang: string; title: string }>): Promise<WikiImage | null> {
  const key = candidates.map((c) => `${c.lang}:${c.title}`).join('|')
  const cached = cache.get(key)
  if (cached) return cached

  const promise = (async () => {
    for (const { lang, title } of candidates) {
      const image = await fetchSummary(lang, title)
      if (image) return image
    }
    return null
  })()

  cache.set(key, promise)
  return promise
}
