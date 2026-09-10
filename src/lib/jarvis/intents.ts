/**
 * Which module a question is about.
 *
 * Matching is deliberately plain: a scored keyword pass, no model, no network.
 * It has to answer instantly and identically every time, and it has to work
 * offline on a plane — which is exactly when Ali will be asking.
 */

export type Intent =
  | 'briefing'
  | 'fortnite_stats'
  | 'fortnite_cups'
  | 'fortnite_training'
  | 'besiktas'
  | 'movies_new'
  | 'movies_recommend'
  | 'watchlist'
  | 'watchparty'
  | 'cinema'
  | 'channel'
  | 'series'
  | 'flight'
  | 'marmaris'
  | 'weather'
  | 'currency'
  | 'tasks'
  | 'comms'
  | 'profile'
  | 'mode'
  | 'system'
  | 'help'
  | 'greeting'
  | 'thanks'
  | 'unknown'

interface Matcher {
  intent: Intent
  /** Each hit adds a point; the highest total wins. */
  words: RegExp[]
  /** A hit here decides immediately. */
  strong?: RegExp[]
}

const MATCHERS: Matcher[] = [
  {
    intent: 'briefing',
    strong: [/was (läuft|steht|gibt.?s|ist) (heute|an|los)/i, /briefing/i, /überblick/i, /lage\b/i],
    words: [/heute/i, /zusammenfassung/i, /alles/i, /status.?bericht/i],
  },
  {
    intent: 'fortnite_stats',
    strong: [/(meine|meinen).{0,12}(fortnite|stats|statistik)/i, /wie sind meine stats/i],
    words: [/fortnite/i, /stats/i, /statistik/i, /k\/?d/i, /siege/i, /wins/i, /kills/i, /rank/i, /elite/i],
  },
  {
    intent: 'fortnite_cups',
    strong: [/(nächst\w*|kommend\w*).{0,14}cup/i, /wann.{0,20}cup/i, /turnier/i],
    words: [/cup/i, /cups/i, /event/i, /fncs/i, /cash cup/i, /solo cup/i, /wettbewerb/i],
  },
  {
    intent: 'fortnite_training',
    strong: [/aim.?training/i, /sensitivity/i, /sensitivität/i, /find your sens/i],
    words: [/aim/i, /sens\b/i, /dpi/i, /edpi/i, /training/i, /zielen/i, /flick/i],
  },
  {
    intent: 'besiktas',
    strong: [/be[sşs]ikta[sş]/i, /bjk/i, /süper ?lig/i, /super ?lig/i],
    words: [/spiel/i, /tabelle/i, /liga/i, /fußball/i, /fussball/i, /verein/i, /derby/i, /kartal/i],
  },
  {
    intent: 'watchparty',
    strong: [/filmabend/i, /watch ?party/i, /was schauen wir/i, /wann schauen wir/i],
    words: [/popcorn/i, /zusammen schauen/i, /angekündigt/i],
  },
  {
    intent: 'cinema',
    strong: [/\bkino\b/i, /capitol/i, /kinoprogramm/i, /leinwand/i],
    words: [/karten/i, /tickets/i, /vorstellung/i, /saal/i, /plauen/i, /popcorn/i],
  },
  {
    intent: 'channel',
    strong: [/direktkanal/i, /neue nachricht/i, /hat.{0,12}geschrieben/i, /nachricht von ronaljarvis/i],
    words: [/kanal/i, /posteingang/i, /ungelesen/i],
  },
  {
    intent: 'movies_recommend',
    strong: [/empfiehl/i, /empfehlung/i, /was soll ich (schauen|gucken|sehen)/i, /vorschlag/i],
    words: [/actionfilm/i, /komödie/i, /horror/i, /thriller/i, /sci-?fi/i, /drama/i, /animation/i],
  },
  {
    intent: 'series',
    strong: [/(welche )?serien?/i],
    words: [/staffel/i, /folge/i, /episode/i],
  },
  {
    intent: 'movies_new',
    strong: [/welche filme sind neu/i, /neue filme/i, /was läuft im kino/i],
    words: [/film/i, /filme/i, /kino/i, /trailer/i, /neuerscheinung/i, /demnächst/i],
  },
  {
    intent: 'watchlist',
    strong: [/watchlist/i, /merkliste/i, /später ansehen/i, /gemerkt/i],
    words: [/liste/i, /vormerken/i],
  },
  {
    intent: 'flight',
    strong: [/wann geht (mein|der) flug/i, /abflug/i, /countdown/i, /wie lange noch/i],
    words: [/flug/i, /flight/i, /gate/i, /sitz/i, /dalaman/i, /landung/i, /reise/i, /koffer/i],
  },
  {
    intent: 'marmaris',
    strong: [/marmaris/i, /was steht.{0,16}marmaris/i],
    words: [/strand/i, /bucht/i, /sehenswürdig/i, /ausflug/i, /türkei/i, /turunç/i, /i[çc]meler/i],
  },
  {
    intent: 'weather',
    strong: [/wetter/i, /temperatur/i],
    words: [/regen/i, /sonne/i, /grad/i, /wassertemperatur/i, /baden/i],
  },
  {
    intent: 'currency',
    strong: [/(lira|tl\b|₺)/i, /wechselkurs/i, /umrechn/i],
    words: [/euro/i, /kurs/i, /geld/i, /€/i, /kosten/i],
  },
  {
    intent: 'tasks',
    strong: [/erinnerung/i, /to.?do/i, /was muss ich/i, /aufgaben/i],
    words: [/liste/i, /packen/i, /besorgen/i, /merken/i],
  },
  {
    intent: 'comms',
    strong: [/tony/i, /nachricht/i],
    words: [/chat/i, /kanal/i, /schreiben/i, /kontakt/i],
  },
  {
    intent: 'profile',
    strong: [/ali database/i, /mein profil/i, /steckbrief/i],
    words: [/profil/i, /über mich/i, /datenbank/i],
  },
  {
    intent: 'mode',
    strong: [/modus/i, /\bmode\b/i],
    words: [/matchday/i, /night/i, /cinema/i, /gaming/i, /emergency/i, /notfall/i],
  },
  {
    intent: 'system',
    strong: [/system.?status/i, /systemstatus/i],
    words: [/status/i, /cpu/i, /netzwerk/i, /performance/i, /läuft alles/i],
  },
  {
    intent: 'help',
    strong: [/^hilfe/i, /was kannst du/i, /befehle/i, /kommandos/i],
    words: [/help/i, /erklär/i],
  },
  {
    intent: 'greeting',
    strong: [/^(hallo|hi|hey|moin|selam|servus|yo)\b/i, /guten (morgen|tag|abend)/i],
    words: [],
  },
  {
    intent: 'thanks',
    strong: [/^(danke|thx|merci|te[sş]ekkür)/i],
    words: [/super/i, /nice/i, /perfekt/i],
  },
]

export function resolveIntent(question: string): Intent {
  const text = question.trim()
  if (!text) return 'unknown'

  let best: { intent: Intent; score: number } = { intent: 'unknown', score: 0 }

  for (const matcher of MATCHERS) {
    let score = 0
    for (const rx of matcher.strong ?? []) if (rx.test(text)) score += 5
    for (const rx of matcher.words) if (rx.test(text)) score += 1
    // Earlier matchers win ties, which is why the specific ones are listed
    // before the broad ones (recommendation before "new films", say).
    if (score > best.score) best = { intent: matcher.intent, score }
  }

  return best.score > 0 ? best.intent : 'unknown'
}

/* -------------------------------------------------------------------------- */
/* Small extractors                                                           */
/* -------------------------------------------------------------------------- */

export const GENRES: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'action', label: 'Action', match: /action/i },
  { key: 'comedy', label: 'Komödie', match: /kom(ö|oe)die|comedy|lustig/i },
  { key: 'horror', label: 'Horror', match: /horror|grusel/i },
  { key: 'thriller', label: 'Thriller', match: /thriller|spannend/i },
  { key: 'scifi', label: 'Sci-Fi', match: /sci-?fi|science.?fiction|weltraum/i },
  { key: 'drama', label: 'Drama', match: /drama/i },
  { key: 'animation', label: 'Animation', match: /animation|anime|zeichentrick/i },
  { key: 'crime', label: 'Krimi', match: /krimi|crime|gangster/i },
]

export function extractGenre(question: string): { key: string; label: string } | null {
  const hit = GENRES.find((g) => g.match.test(question))
  return hit ? { key: hit.key, label: hit.label } : null
}

export interface AmountQuery {
  amount: number
  from: 'EUR' | 'TRY'
}

/** "wie viel sind 250 euro in lira", "300 tl", "was kosten 20 €". */
export function extractAmount(question: string): AmountQuery | null {
  const match = question.match(/(\d[\d.\s]*(?:,\d+)?)\s*(euro|eur|€|lira|tl|try|₺)?/i)
  if (!match) return null
  const raw = match[1].replace(/[.\s]/g, '').replace(',', '.')
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return null

  const unit = (match[2] ?? '').toLowerCase()
  if (/lira|tl|try|₺/.test(unit)) return { amount, from: 'TRY' }
  if (/euro|eur|€/.test(unit)) return { amount, from: 'EUR' }
  // No unit next to the number: fall back to whichever currency is named.
  if (/lira|tl\b|₺/i.test(question)) return { amount, from: 'TRY' }
  return { amount, from: 'EUR' }
}
