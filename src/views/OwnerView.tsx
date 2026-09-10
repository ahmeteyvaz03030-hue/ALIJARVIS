import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../state/SystemProvider'
import { useOwnerFeed } from '../state/useOwnerFeed'
import { newId, shareLink, toFeedJson, type OwnerKind, type OwnerMessage } from '../lib/ownerFeed'
import { loadDetail, posterUrl, searchMovies, type TmdbListItem } from '../lib/tmdb'
import {
  clearOwnerCode,
  lockOwner,
  ownerCodeSet,
  ownerUnlocked,
  setOwnerCode,
  verifyOwnerCode,
} from '../lib/auth/ownerGate'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { HudButton } from '../components/hud/HudButton'
import { StatusPill } from '../components/hud/Readout'
import { VoiceRecorder } from '../components/owner/VoiceRecorder'

/* -------------------------------------------------------------------------- */
/* Gate                                                                       */
/* -------------------------------------------------------------------------- */

function OwnerGate({ onUnlock }: { onUnlock: () => void }) {
  const { cue, pushLog } = useSystem()
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsSetup = !ownerCodeSet()

  const submit = async () => {
    setBusy(true)
    setError(null)
    if (needsSetup) {
      if (code.trim() !== confirm.trim()) {
        setError('Die beiden Eingaben sind nicht gleich.')
        setBusy(false)
        cue('deny')
        return
      }
      const result = await setOwnerCode(code)
      setBusy(false)
      if (result === 'too-short') {
        setError('Mindestens vier Zeichen.')
        cue('deny')
        return
      }
      if (result === 'unsupported') {
        setError('Dieser Browser kann den Code nicht sicher ablegen (kein HTTPS?).')
        cue('deny')
        return
      }
      await verifyOwnerCode(code)
      pushLog('Owner-Konsole eingerichtet', 'ok')
      cue('confirm')
      onUnlock()
      return
    }

    const ok = await verifyOwnerCode(code)
    setBusy(false)
    if (ok) {
      cue('confirm')
      pushLog('Owner-Konsole entsperrt', 'ok')
      onUnlock()
    } else {
      setError('Code stimmt nicht.')
      setCode('')
      cue('deny')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      <HoloCard
        index={0}
        tone="violet"
        title="Owner Console"
        status={needsSetup ? 'EINRICHTEN' : 'GESPERRT'}
        className="lg:col-span-6"
        scan
      >
        <p className="mb-4 text-[0.8rem] leading-relaxed text-ice/65">
          {needsSetup ? (
            <>
              Von hier aus schreibst du als RonalJarvis an Ali. Setz einmal einen Code, damit
              die Konsole nicht offen liegt, wenn Ali das Gerät in der Hand hat. Der Code wird
              nur als Prüfsumme in diesem Browser abgelegt — nie im Klartext, nie im Repo.
            </>
          ) : (
            <>Code eingeben, um als RonalJarvis zu schreiben.</>
          )}
        </p>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div>
            <label className="hud-label mb-1.5 block" htmlFor="owner-code">
              {needsSetup ? 'Neuer Owner-Code' : 'Owner-Code'}
            </label>
            <input
              id="owner-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete={needsSetup ? 'new-password' : 'current-password'}
              className="hud-input text-left text-[0.9rem]"
              style={{ letterSpacing: 'normal' }}
            />
          </div>

          {needsSetup && (
            <div>
              <label className="hud-label mb-1.5 block" htmlFor="owner-code-2">
                Nochmal
              </label>
              <input
                id="owner-code-2"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="hud-input text-left text-[0.9rem]"
                style={{ letterSpacing: 'normal' }}
              />
            </div>
          )}

          {error && <p className="text-[0.74rem] text-danger/85">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <HudButton type="submit" variant="primary" busy={busy} disabled={!code.trim()}>
              {needsSetup ? 'Code setzen' : 'Entsperren'}
            </HudButton>
            {!needsSetup && (
              <HudButton
                variant="ghost"
                onClick={() => {
                  clearOwnerCode()
                  setCode('')
                  setConfirm('')
                  setError(null)
                  cue('nav')
                }}
              >
                Code vergessen — neu setzen
              </HudButton>
            )}
          </div>
        </form>
      </HoloCard>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Film picker                                                                */
/* -------------------------------------------------------------------------- */

interface DraftFilm {
  title: string
  year?: number
  tmdbId?: number
  posterUrl?: string | null
  trailerKey?: string | null
  overview?: string
}

function FilmPicker({
  value,
  onChange,
}: {
  value: DraftFilm | null
  onChange: (film: DraftFilm | null) => void
}) {
  const { settings, cue, pushLog } = useSystem()
  const apiKey = settings.tmdbApiKey
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbListItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState(false)

  const search = async () => {
    if (!apiKey || !query.trim()) return
    setBusy(true)
    cue('process')
    const result = await searchMovies(apiKey, query.trim(), 1)
    setBusy(false)
    setResults(result.ok ? result.data.results.slice(0, 8) : [])
    if (!result.ok) pushLog(`TMDB-Suche fehlgeschlagen: ${result.message}`, 'warn')
  }

  const pick = async (item: TmdbListItem) => {
    cue('confirm')
    const base: DraftFilm = {
      title: item.title,
      year: item.release_date ? Number(item.release_date.slice(0, 4)) : undefined,
      tmdbId: item.id,
      posterUrl: posterUrl(item.poster_path, 'w342'),
      overview: item.overview,
    }
    onChange(base)
    setResults(null)
    setQuery('')
    // The trailer is on the detail endpoint only, so fetch it right away —
    // Ali should get a card he can press play on, not a title.
    if (apiKey) {
      const detail = await loadDetail(apiKey, item.id, 'movie')
      if (detail?.trailerKey) onChange({ ...base, trailerKey: detail.trailerKey })
    }
  }

  if (value) {
    return (
      <div className="flex gap-3 border border-violet/20 bg-violet/[0.04] p-2.5">
        {value.posterUrl && (
          <img src={value.posterUrl} alt="" className="h-24 w-16 shrink-0 border border-cyan/20 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-[0.86rem] font-black text-ice">
            {value.title}
            {value.year ? <span className="text-cyan/45"> · {value.year}</span> : null}
          </div>
          <div className="mt-1 font-mono text-[0.52rem] tracking-[0.1em] text-cyan/45">
            {value.trailerKey ? 'TRAILER GEFUNDEN' : 'KEIN TRAILER HINTERLEGT'}
          </div>
          <div className="mt-2">
            <HudButton small variant="ghost" onClick={() => onChange(null)}>
              Anderen Film wählen
            </HudButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!apiKey && !manual && (
        <p className="text-[0.74rem] leading-relaxed text-amber/75">
          Ohne TMDB-Schlüssel gibt es keine Filmsuche — du kannst den Titel aber von Hand
          eintragen.
        </p>
      )}

      {apiKey && !manual && (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void search()
                }
              }}
              placeholder="Film suchen..."
              className="hud-input flex-1 text-left text-[0.82rem]"
              style={{ letterSpacing: 'normal' }}
            />
            <HudButton small variant="primary" busy={busy} onClick={() => void search()}>
              Suchen
            </HudButton>
          </div>

          {results && (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {results.length === 0 && (
                <p className="py-2 text-[0.74rem] text-ice/50">Nichts gefunden.</p>
              )}
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void pick(item)}
                  className="flex w-full items-center gap-2 border border-cyan/12 bg-cyan/[0.03] px-2 py-1.5 text-left transition-colors hover:border-cyan/40"
                >
                  {item.poster_path && (
                    <img
                      src={posterUrl(item.poster_path, 'w342') ?? ''}
                      alt=""
                      loading="lazy"
                      className="h-10 w-7 shrink-0 object-cover"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[0.78rem] text-ice/85">
                    {item.title}
                  </span>
                  <span className="shrink-0 font-mono text-[0.55rem] text-cyan/40">
                    {item.release_date?.slice(0, 4) ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {manual ? (
        <div className="space-y-2">
          <input
            placeholder="Filmtitel"
            className="hud-input text-left text-[0.82rem]"
            style={{ letterSpacing: 'normal' }}
            onChange={(e) => onChange(e.target.value.trim() ? { title: e.target.value } : null)}
          />
          <HudButton small variant="ghost" onClick={() => setManual(false)}>
            Doch suchen
          </HudButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="font-mono text-[0.55rem] tracking-[0.12em] text-cyan/45 hover:text-cyan"
        >
          TITEL VON HAND EINTRAGEN
        </button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

const KIND_LABEL: Record<OwnerKind, string> = {
  message: 'Nachricht',
  watchparty: 'Filmabend ankündigen',
  cinema: 'Kinotermin',
}

const KIND_ORDER: OwnerKind[] = ['message', 'watchparty', 'cinema']

/** `datetime-local` wants local time without a zone, so build it by hand. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Composer() {
  const { settings, cue, pushLog } = useSystem()
  const feed = useOwnerFeed()
  const [kind, setKind] = useState<OwnerKind>('message')
  const [text, setText] = useState('')
  const [voice, setVoice] = useState<string | null>(null)
  const [film, setFilm] = useState<DraftFilm | null>(null)
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000)))
  const [place, setPlace] = useState('Discord')
  const [note, setNote] = useState('mit Popcorn 🍿')
  const [seat, setSeat] = useState('')
  const [price, setPrice] = useState('')
  const [sent, setSent] = useState<OwnerMessage | null>(null)
  const [copied, setCopied] = useState<'link' | 'json' | null>(null)

  // Sensible defaults per kind, without stomping on anything already typed.
  useEffect(() => {
    if (kind === 'cinema') setPlace((p) => (p === 'Discord' ? settings.cinema.name : p))
    if (kind === 'watchparty') setPlace((p) => (p === settings.cinema.name ? 'Discord' : p))
  }, [kind, settings.cinema.name])

  const needsEvent = kind !== 'message'
  const startsAt = Date.parse(when)
  const valid =
    (text.trim() || voice || film) && (!needsEvent || (Number.isFinite(startsAt) && place.trim()))

  const compose = (): OwnerMessage => ({
    id: newId(kind),
    at: Date.now(),
    kind,
    text: text.trim(),
    from: 'owner',
    ...(voice ? { voice } : {}),
    ...(film ? { film } : {}),
    ...(needsEvent
      ? {
          event: {
            startsAt,
            place: place.trim(),
            note: note.trim() || undefined,
            seat: seat.trim() || undefined,
            price: price.trim() || undefined,
          },
        }
      : {}),
  })

  const send = () => {
    if (!valid) return
    const message = compose()
    feed.add(message)
    setSent(message)
    setCopied(null)
    cue('confirm')
    pushLog(`Owner-Nachricht erstellt: ${message.kind}`, 'core')
  }

  const copy = async (what: 'link' | 'json') => {
    if (!sent) return
    const payload = what === 'link' ? shareLink([sent]) : toFeedJson([...feed.messages])
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(what)
      cue('confirm')
    } catch {
      cue('deny')
    }
  }

  const reset = () => {
    setText('')
    setVoice(null)
    setFilm(null)
    setSeat('')
    setPrice('')
    setSent(null)
    setCopied(null)
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
      <HoloCard index={0} tone="violet" title="Als RonalJarvis schreiben" status="OWNER" className="lg:col-span-7" scan>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {KIND_ORDER.map((k) => (
            <HudButton key={k} small variant={kind === k ? 'primary' : 'ghost'} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </HudButton>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="hud-label mb-1.5 block" htmlFor="owner-text">
              Text — Ali liest das als RonalJarvis
            </label>
            <textarea
              id="owner-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={
                kind === 'watchparty'
                  ? 'Ali, ich hab was für uns rausgesucht. Freitag, Discord, Popcorn steht bereit.'
                  : kind === 'cinema'
                    ? 'Karten sind gebucht. Wir treffen uns halb acht vor dem Eingang.'
                    : 'Was RonalJarvis Ali sagen soll...'
              }
              className="hud-input w-full resize-y text-left text-[0.85rem] leading-relaxed"
              style={{ letterSpacing: 'normal' }}
            />
          </div>

          <VoiceRecorder value={voice} onChange={setVoice} />

          {kind !== 'message' && (
            <>
              <div>
                <div className="hud-label mb-1.5">Film</div>
                <FilmPicker value={film} onChange={setFilm} />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="hud-label mb-1.5 block" htmlFor="owner-when">
                    Wann
                  </label>
                  <input
                    id="owner-when"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="hud-input text-left text-[0.82rem]"
                    style={{ letterSpacing: 'normal' }}
                  />
                </div>
                <div>
                  <label className="hud-label mb-1.5 block" htmlFor="owner-place">
                    Wo
                  </label>
                  <input
                    id="owner-place"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    className="hud-input text-left text-[0.82rem]"
                    style={{ letterSpacing: 'normal' }}
                  />
                </div>
                <div>
                  <label className="hud-label mb-1.5 block" htmlFor="owner-note">
                    Dazu
                  </label>
                  <input
                    id="owner-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="hud-input text-left text-[0.82rem]"
                    style={{ letterSpacing: 'normal' }}
                  />
                </div>
                {kind === 'cinema' && (
                  <>
                    <div>
                      <label className="hud-label mb-1.5 block" htmlFor="owner-seat">
                        Platz
                      </label>
                      <input
                        id="owner-seat"
                        value={seat}
                        onChange={(e) => setSeat(e.target.value)}
                        placeholder="Reihe 8, Platz 11–12"
                        className="hud-input text-left text-[0.82rem]"
                        style={{ letterSpacing: 'normal' }}
                      />
                    </div>
                    <div>
                      <label className="hud-label mb-1.5 block" htmlFor="owner-price">
                        Preis
                      </label>
                      <input
                        id="owner-price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="2 × 11,50 €"
                        className="hud-input text-left text-[0.82rem]"
                        style={{ letterSpacing: 'normal' }}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-violet/12 pt-3">
            <HudButton variant="primary" disabled={!valid} onClick={send}>
              Nachricht erstellen
            </HudButton>
            <HudButton variant="ghost" onClick={reset}>
              Leeren
            </HudButton>
          </div>
        </div>
      </HoloCard>

      {/* --------------------------------------------------------- delivery */}
      <div className="grid auto-rows-min grid-cols-1 content-start gap-3 lg:col-span-5">
        <HoloCard index={1} tone="lime" title="Zustellen" status={sent ? 'BEREIT' : 'WARTET'}>
          {!sent ? (
            <p className="text-[0.78rem] leading-relaxed text-ice/55">
              Schreib links etwas und drück „Nachricht erstellen" — danach stehen hier die zwei
              Wege zu Ali.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE.out }}
              className="space-y-4"
            >
              <div>
                <div className="hud-label mb-1">1 · Sofort — Link schicken</div>
                <p className="mb-2 text-[0.74rem] leading-relaxed text-ice/60">
                  Link kopieren und Ali über WhatsApp oder Discord schicken. Er öffnet ihn, die
                  Nachricht ist da. Kein Deploy nötig.
                </p>
                <HudButton small variant="primary" onClick={() => void copy('link')}>
                  {copied === 'link' ? 'Kopiert ✓' : 'Teilen-Link kopieren'}
                </HudButton>
              </div>

              <div className="border-t border-lime/12 pt-3">
                <div className="hud-label mb-1">2 · Dauerhaft — comms.json</div>
                <p className="mb-2 text-[0.74rem] leading-relaxed text-ice/60">
                  JSON kopieren, in <span className="text-cyan/70">public/comms.json</span>{' '}
                  einsetzen und pushen. Nach dem Deploy sieht Ali die Nachricht auf jedem Gerät,
                  ohne Link — die Seite prüft alle 90 Sekunden nach.
                </p>
                <HudButton small variant="ghost" onClick={() => void copy('json')}>
                  {copied === 'json' ? 'Kopiert ✓' : 'Ganzes comms.json kopieren'}
                </HudButton>
              </div>

              <p className="border-t border-lime/12 pt-3 font-mono text-[0.5rem] leading-relaxed text-cyan/35">
                Die Nachricht liegt schon in diesem Browser — im Direktkanal siehst du sie so,
                wie Ali sie sehen wird.
              </p>
            </motion.div>
          )}
        </HoloCard>

        <HoloCard index={2} tone="cyan" title="Verlauf" status={`${feed.messages.length}`}>
          {feed.messages.length === 0 ? (
            <p className="text-[0.76rem] text-ice/50">Noch nichts im Kanal.</p>
          ) : (
            <div className="space-y-1.5">
              {feed.messages.slice(0, 10).map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-2 border-l-2 pl-2"
                  style={{ borderColor: m.from === 'ali' ? 'rgba(140,255,120,0.5)' : 'rgba(53,230,255,0.4)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.76rem] text-ice/85">
                      {m.text || (m.voice ? '🎙 Sprachnachricht' : m.film?.title) || '—'}
                    </div>
                    <div className="font-mono text-[0.48rem] tracking-[0.1em] text-cyan/35">
                      {m.from === 'ali' ? 'ALI' : 'DU'} ·{' '}
                      {new Date(m.at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {m.kind !== 'message' ? ` · ${m.kind.toUpperCase()}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => feed.remove(m.id)}
                    aria-label="Nachricht entfernen"
                    className="shrink-0 font-mono text-[0.6rem] text-cyan/30 hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </HoloCard>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* View                                                                       */
/* -------------------------------------------------------------------------- */

export function OwnerView() {
  const { cue } = useSystem()
  const [unlocked, setUnlocked] = useState(() => ownerUnlocked())

  if (!unlocked) return <OwnerGate onUnlock={() => setUnlocked(true)} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="violet">OWNER-KONSOLE OFFEN</StatusPill>
        <span className="font-mono text-[0.55rem] tracking-[0.12em] text-cyan/40">
          Alles, was du hier schreibst, erscheint bei Ali als RonalJarvis.
        </span>
        <div className="ml-auto">
          <HudButton
            small
            variant="ghost"
            onClick={() => {
              lockOwner()
              setUnlocked(false)
              cue('nav')
            }}
          >
            Sperren
          </HudButton>
        </div>
      </div>
      <Composer />
    </div>
  )
}
