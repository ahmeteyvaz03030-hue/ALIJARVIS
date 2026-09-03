export type PosterArt = 'rings' | 'grid' | 'sun' | 'wave' | 'monolith'

export interface Movie {
  id: string
  title: string
  year: number
  genre: string
  runtime: number
  rating: number
  tagline: string
  synopsis: string
  palette: [string, string]
  art: PosterArt
  /** Watch-together status for the trip. */
  status: 'QUEUED' | 'DOWNLOADED' | 'WATCHING'
}

/**
 * Entertainment index for the trip. Poster artwork is generated in-app (no
 * external images), so the module works fully offline.
 */
export const MOVIES: Movie[] = [
  {
    id: 'dune-2',
    title: 'DUNE: PART TWO',
    year: 2024,
    genre: 'SCI-FI / EPIC',
    runtime: 166,
    rating: 8.5,
    tagline: 'Lang lebe die Kämpfer.',
    synopsis:
      'Paul Atreides verbündet sich mit den Fremen, um Rache an denen zu nehmen, die seine Familie zerstört haben — während er versucht, eine Zukunft zu verhindern, die nur er sehen kann.',
    palette: ['#c98b3f', '#3a1f0c'],
    art: 'sun',
    status: 'DOWNLOADED',
  },
  {
    id: 'blade-runner',
    title: 'BLADE RUNNER 2049',
    year: 2017,
    genre: 'NEO-NOIR / SCI-FI',
    runtime: 163,
    rating: 8.0,
    tagline: 'Die Schlüssel zur Zukunft sind Erinnerungen.',
    synopsis:
      'Der junge Blade Runner K entdeckt ein lange verborgenes Geheimnis und macht sich auf die Suche nach Rick Deckard, der seit dreißig Jahren verschwunden ist.',
    palette: ['#ff8a3d', '#2a0f2e'],
    art: 'monolith',
    status: 'DOWNLOADED',
  },
  {
    id: 'interstellar',
    title: 'INTERSTELLAR',
    year: 2014,
    genre: 'SCI-FI / DRAMA',
    runtime: 169,
    rating: 8.7,
    tagline: 'Die Menschheit wurde auf der Erde geboren. Sie war nie dazu bestimmt, hier zu sterben.',
    synopsis:
      'Ein Team von Forschern reist durch ein Wurmloch, um einen neuen Lebensraum für die Menschheit zu finden — und zahlt dafür in Zeit.',
    palette: ['#5b7fa8', '#080d18'],
    art: 'rings',
    status: 'QUEUED',
  },
  {
    id: 'tenet',
    title: 'TENET',
    year: 2020,
    genre: 'ACTION / THRILLER',
    runtime: 150,
    rating: 7.3,
    tagline: 'Zeit läuft nicht ab. Sie läuft rückwärts.',
    synopsis:
      'Ein Agent kämpft mit einer Technologie, die den Zeitfluss umkehrt, um einen Dritten Weltkrieg zu verhindern.',
    palette: ['#3f8fa8', '#0a1620'],
    art: 'grid',
    status: 'QUEUED',
  },
  {
    id: 'arrival',
    title: 'ARRIVAL',
    year: 2016,
    genre: 'SCI-FI / DRAMA',
    runtime: 116,
    rating: 7.9,
    tagline: 'Warum sind sie hier?',
    synopsis:
      'Eine Linguistin wird rekrutiert, um mit außerirdischen Besuchern zu kommunizieren — und lernt dabei eine völlig neue Art zu denken.',
    palette: ['#6f7f6a', '#101812'],
    art: 'monolith',
    status: 'QUEUED',
  },
  {
    id: 'oppenheimer',
    title: 'OPPENHEIMER',
    year: 2023,
    genre: 'BIOPIC / DRAMA',
    runtime: 180,
    rating: 8.3,
    tagline: 'Die Welt verändert sich für immer.',
    synopsis:
      'Die Geschichte des Physikers J. Robert Oppenheimer und seiner Rolle bei der Entwicklung der Atombombe.',
    palette: ['#d9603a', '#1a0c08'],
    art: 'sun',
    status: 'WATCHING',
  },
  {
    id: 'mad-max',
    title: 'FURIOSA',
    year: 2024,
    genre: 'ACTION / ADVENTURE',
    runtime: 148,
    rating: 7.6,
    tagline: 'Rache braucht einen Plan.',
    synopsis:
      'Die Vorgeschichte von Furiosa, die aus dem Grünen Ort entführt wird und sich durch das Ödland zurückkämpft.',
    palette: ['#e08b2c', '#2b1305'],
    art: 'wave',
    status: 'QUEUED',
  },
  {
    id: 'top-gun',
    title: 'TOP GUN: MAVERICK',
    year: 2022,
    genre: 'ACTION / DRAMA',
    runtime: 130,
    rating: 8.2,
    tagline: 'Feel the need for speed.',
    synopsis:
      'Nach über dreißig Jahren Dienst kehrt Maverick zurück, um eine neue Generation von Piloten auf eine unmögliche Mission vorzubereiten.',
    palette: ['#4a89c9', '#0b1524'],
    art: 'wave',
    status: 'DOWNLOADED',
  },
  {
    id: 'inception',
    title: 'INCEPTION',
    year: 2010,
    genre: 'SCI-FI / HEIST',
    runtime: 148,
    rating: 8.8,
    tagline: 'Dein Verstand ist der Tatort.',
    synopsis:
      'Ein Meisterdieb, der in Träume eindringt, erhält den Auftrag, eine Idee einzupflanzen anstatt eine zu stehlen.',
    palette: ['#7a8fa3', '#0d1218'],
    art: 'grid',
    status: 'QUEUED',
  },
  {
    id: 'gladiator',
    title: 'GLADIATOR II',
    year: 2024,
    genre: 'HISTORY / ACTION',
    runtime: 148,
    rating: 7.1,
    tagline: 'Das Imperium wird fallen.',
    synopsis:
      'Jahre nach dem Tod von Maximus kämpft Lucius in der Arena um seine Freiheit und die Zukunft Roms.',
    palette: ['#c2873f', '#231407'],
    art: 'rings',
    status: 'QUEUED',
  },
]
