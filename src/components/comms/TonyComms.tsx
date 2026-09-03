import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { clockStamp } from '../../lib/hooks'
import { HudButton } from '../hud/HudButton'
import type { CommMessage, CommsPhase } from '../../state/useComms'

const HANDSHAKE = [
  'CONNECTING TO TONY...',
  'ESTABLISHING PRIVATE CHANNEL...',
  'KEY EXCHANGE — 4096 BIT',
  'SESSION ACTIVE',
]

/** The connection cinematic played the first time the channel opens. */
function Handshake({ phase }: { phase: CommsPhase }) {
  const { calm } = useSystem()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (phase !== 'connecting') return
    const timers = HANDSHAKE.map((_, i) =>
      window.setTimeout(() => setStep(i), i * (calm ? 120 : 640)),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [phase, calm])

  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center gap-5 p-6">
      {/* link animation: two nodes with a beam being established */}
      <div className="relative flex w-full max-w-xs items-center justify-between">
        {['ALI', 'TONY'].map((who, i) => (
          <div key={who} className="relative z-10 flex flex-col items-center gap-1.5">
            <motion.span
              className="flex h-10 w-10 items-center justify-center border border-cyan/45 bg-void font-display text-[0.6rem] font-black text-cyan"
              animate={calm ? undefined : { boxShadow: ['0 0 0 rgba(53,230,255,0)', '0 0 18px rgba(53,230,255,0.6)', '0 0 0 rgba(53,230,255,0)'] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
            >
              {who.slice(0, 2)}
            </motion.span>
            <span className="font-mono text-[0.5rem] tracking-[0.2em] text-cyan/50">{who}</span>
          </div>
        ))}
        {/* beam */}
        <div className="absolute inset-x-10 top-5 h-px bg-cyan/15">
          <motion.div
            className="h-full bg-cyan"
            style={{ boxShadow: '0 0 10px #35e6ff' }}
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: step >= 3 ? 1 : (step + 1) / 4 }}
            transition={{ duration: 0.6, ease: EASE.out }}
          />
          {!calm && (
            <motion.span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ice"
              style={{ boxShadow: '0 0 8px #35e6ff' }}
              animate={{ left: ['0%', '100%'] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        {HANDSHAKE.map((line, i) => (
          <AnimatePresence key={line}>
            {i <= step && (
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: i === step ? 1 : 0.45, x: 0 }}
                transition={{ duration: 0.34, ease: EASE.out }}
                className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.14em]"
                style={{ color: i === 3 ? '#7cff9b' : 'rgba(53,230,255,0.9)' }}
              >
                <span className="text-cyan/35">&gt;</span>
                {line}
                {i === step && i < 3 && (
                  <span className="jv-blink inline-block h-3 w-1.5 bg-cyan" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  )
}

function Bubble({ message, index }: { message: CommMessage; index: number }) {
  const mine = message.from === 'ali'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, ease: EASE.out, delay: Math.min(index * 0.02, 0.2) }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[82%] ${mine ? 'text-right' : ''}`}>
        <div
          className="relative px-3 py-2 text-[0.82rem] leading-relaxed"
          style={{
            background: mine ? 'rgba(53,230,255,0.10)' : 'rgba(124,255,155,0.07)',
            border: `1px solid ${mine ? 'rgba(53,230,255,0.3)' : 'rgba(124,255,155,0.26)'}`,
            clipPath: mine
              ? 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)'
              : 'polygon(0 8px, 8px 0, 100% 0, 100% 100%, 0 100%)',
            color: '#dff8ff',
          }}
        >
          {message.text}
        </div>
        <div className="mt-1 font-mono text-[0.5rem] tracking-[0.16em] text-cyan/35">
          {message.from === 'ali' ? 'ALI' : 'TONY'} · {clockStamp(message.at)}
        </div>
      </div>
    </motion.div>
  )
}

export function TonyComms({
  messages,
  phase,
  tonyTyping,
  onConnect,
  onSend,
}: {
  messages: CommMessage[]
  phase: CommsPhase
  tonyTyping: boolean
  onConnect: () => void
  onSend: (text: string) => void
}) {
  const { calm } = useSystem()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (phase === 'offline') onConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: calm ? 'auto' : 'smooth' })
  }, [messages.length, tonyTyping, calm])

  return (
    <div className="panel panel-cut relative flex h-full min-h-[30rem] flex-col overflow-hidden lg:min-h-[calc(100vh-11rem)]">
      {!calm && <div className="edge-shimmer" />}

      <header className="flex items-center justify-between gap-3 border-b border-lime/18 bg-gradient-to-r from-lime/[0.07] to-transparent px-4 py-2.5">
        <div className="flex items-center gap-2">
          <motion.span
            className="h-1.5 w-1.5 rotate-45 bg-lime"
            animate={calm || phase !== 'active' ? undefined : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="hud-label" style={{ color: 'rgba(124,255,155,0.8)' }}>
            Tony Comms · Private Channel
          </span>
        </div>
        <span className="font-mono text-[0.55rem] tracking-[0.2em] text-lime/70">
          {phase === 'active' ? 'SESSION ACTIVE' : phase === 'connecting' ? 'HANDSHAKE' : 'OFFLINE'}
        </span>
      </header>

      <AnimatePresence mode="wait">
        {phase !== 'active' ? (
          <motion.div
            key="handshake"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="flex-1"
          >
            <Handshake phase={phase} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE.out }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ scrollbarGutter: 'stable' }}
            >
              {messages.map((m, i) => (
                <Bubble key={m.id} message={m} index={i} />
              ))}

              <AnimatePresence>
                {tonyTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 pl-1"
                  >
                    <span className="font-mono text-[0.55rem] tracking-[0.18em] text-lime/60">
                      TONY SCHREIBT
                    </span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1 w-1 rounded-full bg-lime"
                          animate={calm ? undefined : { opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
                        />
                      ))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <form
              className="flex items-center gap-2 border-t border-cyan/12 bg-void/50 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                onSend(draft)
                setDraft('')
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Nachricht an Tony..."
                aria-label="Nachricht an Tony"
                className="hud-input flex-1 py-2 text-[0.82rem] tracking-normal"
                style={{ letterSpacing: 'normal' }}
              />
              <HudButton type="submit" variant="primary" small disabled={!draft.trim()}>
                Senden
              </HudButton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
