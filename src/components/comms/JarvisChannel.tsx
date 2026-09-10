import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useOwnerFeed } from '../../state/useOwnerFeed'
import { shareLink, type OwnerMessage } from '../../lib/ownerFeed'
import { speak, speechSupported } from '../../lib/speech'
import { EASE } from '../../lib/motion'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'
import { StatusPill } from '../hud/Readout'

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

const stamp = (at: number) =>
  new Date(at).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

function countdown(target: number, now: number): string {
  const ms = target - now
  if (ms <= 0) return 'LÄUFT'
  const mins = Math.floor(ms / 60_000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  if (days > 0) return `IN ${days} T ${hours} H`
  if (hours > 0) return `IN ${hours} H ${mins % 60} MIN`
  return `IN ${mins} MIN`
}

/** The owner's actual recorded voice, not a synthesised one. */
function VoiceNote({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  return (
    <div className="mt-2 flex items-center gap-2 border border-lime/25 bg-lime/[0.05] px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => {
          const el = audioRef.current
          if (!el) return
          if (playing) {
            el.pause()
            el.currentTime = 0
            setPlaying(false)
          } else {
            void el.play()
            setPlaying(true)
          }
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center border border-lime/50 text-[0.6rem] text-lime"
        aria-label={playing ? 'Sprachnachricht stoppen' : 'Sprachnachricht abspielen'}
      >
        {playing ? '■' : '▶'}
      </button>
      <div className="flex flex-1 items-end gap-[2px]" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <motion.span
            key={i}
            className="w-[3px] bg-lime/60"
            animate={playing ? { height: [4, 6 + ((i * 7) % 14), 4] } : { height: 4 + ((i * 5) % 9) }}
            transition={
              playing
                ? { duration: 0.7, repeat: Infinity, delay: i * 0.035, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[0.5rem] tracking-[0.12em] text-lime/60">
        STIMME
      </span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        preload="none"
      />
    </div>
  )
}

function TrailerBox({ trailerKey, title }: { trailerKey: string; title: string }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <div className="mt-2 aspect-video w-full overflow-hidden border border-cyan/25 bg-black">
      <iframe
        title={`Trailer ${title}`}
        src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
        className="h-full w-full"
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-2 flex w-full items-center justify-center gap-2 border border-cyan/25 bg-cyan/[0.05] py-1.5 font-display text-[0.56rem] font-black tracking-[0.2em] text-cyan transition-colors hover:border-cyan/60"
    >
      ▶ TRAILER ABSPIELEN
    </button>
  )
}

function MessageCard({
  message,
  now,
  fresh,
  onSpeak,
}: {
  message: OwnerMessage
  now: number
  fresh: boolean
  onSpeak?: (text: string) => void
}) {
  const mine = message.from === 'ali'
  const event = message.event
  const film = message.film

  const tone = mine ? 'lime' : message.kind === 'cinema' ? 'amber' : 'cyan'
  const border = { lime: 'rgba(140,255,120,0.3)', amber: 'rgba(255,181,77,0.32)', cyan: 'rgba(53,230,255,0.28)' }[tone]
  const bg = { lime: 'rgba(140,255,120,0.05)', amber: 'rgba(255,181,77,0.05)', cyan: 'rgba(53,230,255,0.05)' }[tone]

  return (
    <motion.div
      initial={{ opacity: 0, x: mine ? 18 : -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.36, ease: EASE.out }}
      className={mine ? 'flex justify-end' : ''}
    >
      <div
        className="max-w-[95%] border px-3 py-2.5"
        style={{
          borderColor: border,
          background: bg,
          clipPath: mine
            ? 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)'
            : 'polygon(0 8px, 8px 0, 100% 0, 100% 100%, 0 100%)',
        }}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="h-1 w-1 rotate-45" style={{ background: `rgb(${mine ? '140,255,120' : '53,230,255'})` }} />
          <span className="font-display text-[0.48rem] font-bold tracking-[0.22em]" style={{ color: mine ? '#8cff78' : '#35e6ff' }}>
            {mine ? 'ALI' : 'RONALJARVIS'}
          </span>
          {fresh && !mine && (
            <span className="bg-danger px-1 py-[1px] font-display text-[0.42rem] font-black tracking-[0.14em] text-void">
              NEU
            </span>
          )}
          {message.kind === 'watchparty' && (
            <span className="border border-violet/45 px-1 py-[1px] font-display text-[0.42rem] font-black tracking-[0.12em] text-violet">
              FILMABEND
            </span>
          )}
          {message.kind === 'cinema' && (
            <span className="border border-amber/45 px-1 py-[1px] font-display text-[0.42rem] font-black tracking-[0.12em] text-amber">
              KINO
            </span>
          )}
          <span className="ml-auto font-mono text-[0.48rem] tracking-[0.1em] text-cyan/35">
            {stamp(message.at)}
          </span>
        </div>

        {message.text && (
          <p className="whitespace-pre-wrap text-[0.84rem] leading-relaxed text-ice/90">
            {message.text}
          </p>
        )}

        {message.voice && <VoiceNote src={message.voice} />}

        {film && (
          <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: border }}>
            <div className="flex gap-2.5">
              {film.posterUrl && (
                <img
                  src={film.posterUrl}
                  alt=""
                  loading="lazy"
                  className="h-24 w-16 shrink-0 border border-cyan/20 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display text-[0.86rem] font-black leading-tight text-ice">
                  {film.title}
                  {film.year ? <span className="text-cyan/45"> · {film.year}</span> : null}
                </div>
                {film.overview && (
                  <p className="mt-1 line-clamp-3 text-[0.72rem] leading-snug text-ice/60">
                    {film.overview}
                  </p>
                )}
              </div>
            </div>
            {film.trailerKey && <TrailerBox trailerKey={film.trailerKey} title={film.title} />}
          </div>
        )}

        {event && (
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t pt-2.5 sm:grid-cols-4" style={{ borderColor: border }}>
            {[
              ['WANN', new Date(event.startsAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
              ['WO', event.place || '—'],
              ...(event.seat ? [['PLATZ', event.seat]] : []),
              ...(event.price ? [['PREIS', event.price]] : []),
              ...(event.note ? [['DAZU', event.note]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <div className="hud-label text-[0.42rem]">{k}</div>
                <div className="font-display text-[0.7rem] font-bold leading-tight text-ice">{v}</div>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-4">
              <StatusPill tone={event.startsAt - now <= 0 ? 'lime' : 'amber'} pulse>
                {countdown(event.startsAt, now)}
              </StatusPill>
            </div>
          </div>
        )}

        {!mine && onSpeak && message.text && speechSupported() && (
          <button
            type="button"
            onClick={() => onSpeak(message.text)}
            className="mt-2 font-mono text-[0.52rem] tracking-[0.12em] text-cyan/45 hover:text-cyan"
          >
            ♪ VORLESEN
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export function JarvisChannel({ index = 0, className }: { index?: number; className?: string }) {
  const { settings, cue, pushLog, setJarvisSpeaking } = useSystem()
  const feed = useOwnerFeed(true)
  const [draft, setDraft] = useState('')
  const [replyLink, setReplyLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const freshIds = useRef<Set<string>>(new Set())
  const announced = useRef<Set<string>>(new Set())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // Anything unread when the panel opens keeps its NEU badge for this visit,
  // even though opening the panel marks it read.
  useEffect(() => {
    for (const m of feed.unread) freshIds.current.add(m.id)
    feed.markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.unread.length])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.messages.length])

  const doSpeak = (text: string) => {
    setJarvisSpeaking(true)
    speak(text, {
      voiceURI: settings.voiceURI,
      rate: settings.voiceRate,
      onEnd: () => setJarvisSpeaking(false),
    })
  }

  // A newly arrived message is read out once, if the voice is switched on.
  useEffect(() => {
    if (!settings.voiceEnabled) return
    const newest = feed.messages.find((m) => m.from !== 'ali')
    if (!newest || announced.current.has(newest.id)) return
    announced.current.add(newest.id)
    // Only speak what actually arrived while the app was open.
    if (Date.now() - newest.at > 10 * 60_000) return
    if (newest.voice) return // his real voice beats a synthetic reading of it
    doSpeak(newest.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.messages, settings.voiceEnabled])

  const ordered = useMemo(() => [...feed.messages].sort((a, b) => a.at - b.at), [feed.messages])

  const sendReply = () => {
    const text = draft.trim()
    if (!text) return
    const message = feed.add({ kind: 'message', text, from: 'ali' })
    setDraft('')
    cue('key')
    pushLog('Antwort an RonalJarvis geschrieben', 'core')
    // No server to post to — so the reply becomes a link Ali can send back.
    try {
      setReplyLink(shareLink([message]))
    } catch {
      setReplyLink(null)
    }
    setCopied(false)
  }

  const copyReply = async () => {
    if (!replyLink) return
    try {
      await navigator.clipboard.writeText(replyLink)
      setCopied(true)
      cue('confirm')
    } catch {
      cue('deny')
    }
  }

  return (
    <HoloCard
      index={index}
      tone="cyan"
      title="RonalJarvis · Direktkanal"
      status={feed.unread.length ? `${feed.unread.length} NEU` : feed.reachable ? 'VERBUNDEN' : 'LOKAL'}
      className={className}
      bodyClassName="p-4"
      scan
    >
      {/* A fixed height, not a minimum: the message list has to scroll inside
          the card, otherwise a long conversation pushes the reply box off the
          bottom of the page. */}
      <div className="flex h-[32rem] max-h-[75vh] flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {ordered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="font-display text-[0.56rem] font-black tracking-[0.24em] text-cyan/45">
                KANAL OFFEN
              </span>
              <p className="max-w-sm text-[0.78rem] leading-relaxed text-ice/50">
                Hier landen Nachrichten, Filmabende und Kinotermine, die direkt für dich
                reinkommen. Noch ist nichts da.
              </p>
            </div>
          ) : (
            ordered.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                now={now}
                fresh={freshIds.current.has(message.id)}
                onSpeak={doSpeak}
              />
            ))
          )}
        </div>

        <AnimatePresence>
          {replyLink && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="border border-lime/25 bg-lime/[0.05] px-2.5 py-2">
                <div className="hud-label mb-1">Antwort verschicken</div>
                <p className="mb-2 text-[0.7rem] leading-relaxed text-ice/60">
                  Kopier den Link und schick ihn zurück — er trägt deine Antwort.
                </p>
                <div className="flex flex-wrap gap-2">
                  <HudButton small variant="primary" onClick={() => void copyReply()}>
                    {copied ? 'Kopiert ✓' : 'Link kopieren'}
                  </HudButton>
                  <HudButton small variant="ghost" onClick={() => setReplyLink(null)}>
                    Schließen
                  </HudButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            sendReply()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Antwort an RonalJarvis..."
            aria-label="Antwort an RonalJarvis"
            className="hud-input flex-1 py-2 text-[0.84rem]"
            style={{ letterSpacing: 'normal' }}
          />
          <HudButton type="submit" variant="primary" small disabled={!draft.trim()}>
            Senden
          </HudButton>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[0.5rem] tracking-[0.12em] text-cyan/30">
          <span>{feed.reachable ? 'FEED ERREICHBAR' : 'FEED NICHT VERÖFFENTLICHT'}</span>
          {feed.lastPoll > 0 && (
            <span>· ZULETZT GEPRÜFT {new Date(feed.lastPoll).toLocaleTimeString('de-DE')}</span>
          )}
          <button
            type="button"
            onClick={() => void feed.refresh()}
            className="ml-auto tracking-[0.14em] text-cyan/45 hover:text-cyan"
          >
            JETZT PRÜFEN
          </button>
        </div>
      </div>
    </HoloCard>
  )
}
