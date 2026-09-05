export interface Poi {
  id: string
  name: string
  /** Compact label for the radar, where space is tight. */
  short: string
  kind: 'BEACH' | 'LANDMARK' | 'BAY' | 'VIEWPOINT' | 'HARBOUR' | 'NATURE'
  /** Bearing from Marmaris centre, degrees. */
  bearing: number
  /** Normalised radar distance 0…1. */
  radar: number
  distanceKm: number
  note: string
  /** Wikipedia article candidates for a real photo, tried in order (see lib/wikiImages.ts). */
  wiki: Array<{ lang: string; title: string }>
}

/** Points of interest that populate the MARMARIS AREA SCAN radar. */
export const POIS: Poi[] = [
  {
    id: 'kalesi',
    name: 'MARMARIS KALESI',
    short: 'KALESI',
    kind: 'LANDMARK',
    bearing: 96,
    radar: 0.18,
    distanceKm: 0.9,
    note: 'Festung aus dem 16. Jh. über dem alten Hafen — bester Blick auf die Bucht.',
    wiki: [{ lang: 'tr', title: 'Marmaris Kalesi' }, { lang: 'en', title: 'Marmaris Castle' }],
  },
  {
    id: 'icmeler',
    name: 'İÇMELER BEACH',
    short: 'İÇMELER',
    kind: 'BEACH',
    bearing: 232,
    radar: 0.52,
    distanceKm: 8.4,
    note: 'Langer Kiesstrand, ruhigeres Wasser, Berge direkt im Rücken.',
    wiki: [{ lang: 'tr', title: 'İçmeler' }, { lang: 'en', title: 'İçmeler' }],
  },
  {
    id: 'turunc',
    name: 'TURUNÇ BAY',
    short: 'TURUNÇ',
    kind: 'BAY',
    bearing: 205,
    radar: 0.78,
    distanceKm: 18.6,
    note: 'Per Boot in 25 Minuten. Türkisblaue Bucht, wenig Trubel.',
    wiki: [{ lang: 'tr', title: 'Turunç, Marmaris' }, { lang: 'en', title: 'Turunç' }],
  },
  {
    id: 'paradise',
    name: 'PARADISE ISLAND',
    short: 'PARADISE',
    kind: 'NATURE',
    bearing: 158,
    radar: 0.62,
    distanceKm: 12.1,
    note: 'Nimara-Insel mit Höhle und Panoramaweg über dem Golf.',
    wiki: [{ lang: 'tr', title: 'Nimara Mağarası' }, { lang: 'en', title: 'Nimara Cave' }],
  },
  {
    id: 'sunset',
    name: 'SUNSET POINT',
    short: 'SUNSET',
    kind: 'VIEWPOINT',
    bearing: 288,
    radar: 0.44,
    distanceKm: 6.2,
    note: 'Sonnenuntergang über der Bucht — beste Zeit 19:40.',
    wiki: [{ lang: 'tr', title: 'Marmaris Günbatımı' }],
  },
  {
    id: 'marina',
    name: 'NETSEL MARINA',
    short: 'MARINA',
    kind: 'HARBOUR',
    bearing: 78,
    radar: 0.26,
    distanceKm: 1.6,
    note: 'Yachthafen mit Promenade, Cafés und Bootstouren.',
    wiki: [{ lang: 'en', title: 'Netsel Marina' }],
  },
  {
    id: 'bozburun',
    name: 'BOZBURUN',
    short: 'BOZBURUN',
    kind: 'BAY',
    bearing: 250,
    radar: 0.95,
    distanceKm: 42.0,
    note: 'Ruhiges Fischerdorf auf der Halbinsel — Gulet-Werften.',
    wiki: [{ lang: 'tr', title: 'Bozburun' }, { lang: 'en', title: 'Bozburun' }],
  },
]

export const KIND_TONE: Record<Poi['kind'], 'cyan' | 'lime' | 'amber'> = {
  BEACH: 'lime',
  LANDMARK: 'amber',
  BAY: 'cyan',
  VIEWPOINT: 'amber',
  HARBOUR: 'cyan',
  NATURE: 'lime',
}

export const MARMARIS_FACTS = [
  { label: 'BEVÖLKERUNG', value: '~38.000' },
  { label: 'ZEITZONE', value: 'UTC+3' },
  { label: 'WÄHRUNG', value: 'TRY ₺' },
  { label: 'SPRACHE', value: 'TÜRKÇE' },
  { label: 'FLUGHAFEN', value: 'DLM · 90 KM' },
  { label: 'MEER', value: 'ÄGÄIS / MITTELMEER' },
]
