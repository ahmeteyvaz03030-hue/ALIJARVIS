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
  /** Full-resolution version for the lightbox, when one is available. */
  fullUrl?: string
  /** Roughly 2:1 and wide enough to be an equirectangular panorama. */
  panorama?: boolean
}

interface WikiSummary {
  title: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string } }
}

/** An image is treated as a 360° panorama when it is very wide and close to
 *  the 2:1 ratio equirectangular projections use. */
function looksPanoramic(width: number, height: number, title: string): boolean {
  if (/panorama|360|equirect/i.test(title)) return width / height >= 1.8
  return width >= 2000 && Math.abs(width / height - 2) < 0.25
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
    const full = data.originalimage ?? image
    return {
      url: image.source,
      width: image.width,
      height: image.height,
      fullUrl: full.source,
      panorama: looksPanoramic(full.width, full.height, data.title),
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


/* -------------------------------------------------------------------------- */
/* Galleries via Wikimedia Commons                                            */
/* -------------------------------------------------------------------------- */

interface CommonsPage {
  title: string
  imageinfo?: Array<{
    url: string
    thumburl?: string
    thumbwidth?: number
    thumbheight?: number
    width: number
    height: number
    descriptionurl: string
  }>
}

const galleryCache = new Map<string, Promise<WikiImage[]>>()

/**
 * Several real photos for one place, straight from Wikimedia Commons.
 *
 * `origin=*` is what makes this callable from a browser: Commons then serves
 * the response with permissive CORS headers for anonymous requests. Failure of
 * any kind resolves to an empty array — the gallery is an enhancement, never a
 * requirement.
 */
export function getCommonsGallery(query: string, limit = 8): Promise<WikiImage[]> {
  const key = `${query}::${limit}`
  const cached = galleryCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|size',
      iiurlwidth: '800',
    })
    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
      if (!response.ok) return []
      const json = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } }
      const pages = Object.values(json.query?.pages ?? {})
      return pages
        .map((page): WikiImage | null => {
          const info = page.imageinfo?.[0]
          if (!info) return null
          const title = page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
          return {
            url: info.thumburl ?? info.url,
            width: info.thumbwidth ?? info.width,
            height: info.thumbheight ?? info.height,
            fullUrl: info.url,
            panorama: looksPanoramic(info.width, info.height, page.title),
            pageUrl: info.descriptionurl,
            title,
          }
        })
        .filter((x): x is WikiImage => x !== null)
    } catch {
      return []
    }
  })()

  galleryCache.set(key, promise)
  return promise
}
