import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useTypewriter } from '../../lib/hooks'
import { EASE } from '../../lib/motion'
import { MODE_SPEC } from '../../lib/jarvisModes'
import { PROCESS_STEPS } from '../../lib/jarvis/brain'
import { speak, stopSpeaking } from '../../lib/speech'
import type { JarvisAnswer } from '../../lib/jarvis/types'
import { useJarvisBrain } from './useJarvisBrain'
import { AnswerBlocks } from './AnswerBlocks'
import { HudButton } from '../hud/HudButton'

interface Turn {
  id: number
  role: 'ali' | 'jarvis'
  text: string
  answer?: JarvisAnswer
  /** Freshly generated answers type themselves; history renders instantly. */
  fresh?: boolean
}

export const SUGGESTIONS = [
  'Was läuft heute?',
  'Wie sind meine Fortnite Stats?',
  'Wann spielt Beşiktaş?',
  'Welche Filme sind neu?',
  'Empfiehl mir einen Actionfilm.',
  'Zeig mir meine Watchlist.',
  'Wann geht mein Flug?',
  'Wie viel sind 250 Euro in Lira?',
]

/** Answer bubble with the typewriter effect, then the structured blocks. */
function JarvisAnswerBubble({
  turn,
  onStart,
  onEnd,
  onNavigate,
}: {
  turn: Turn
  onStart: () => void
  onEnd: () => void
  onNavigate?: (view: string) => void
}) {
  const { calm } = useSystem()
  const started = useRef(false)
  const fresh = Boolean(turn.fresh)

  useEffect(() => {
    if (fresh && !started.current) {
      started.current = true
      onStart()
    }
  }, [fresh, onStart])

  const { shown, done, skip } = useTypewriter(turn.text, {
    cps: calm ? 4000 : 52,
    enabled: fresh,
    onDone: fresh ? onEnd : undefined,
  })

  const blocks = turn.answer?.blocks ?? []
  const actions = turn.answer?.actions.filter((a) => a.view) ?? []

  return (
    <div
      className="relative border border-cyan/22 bg-cyan/[0.05] px-3 py-2.5"
      style={{ clipPath: 'polygon(0 8px, 8px 0, 100% 0, 100% 100%, 0 100%)' }}
      onClick={() => !done && skip()}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-1 w-1 rotate-45 bg-cyan" />
        <span className="font-display text-[0.48rem] font-bold tracking-[0.22em] text-cyan/70">
          RONALJARVIS
        </span>
      </div>
      <p className="text-[0.84rem] leading-relaxed text-ice/90">
        {shown}
        {!done && (
          <span className="jv-blink ml-0.5 inline-block h-3.5 w-1.5 translate-y-[1px] bg-cyan" />
        )}
      </p>

      {/* Blocks wait for the line to finish so the answer lands as one thought. */}
      {done && <AnswerBlocks blocks={blocks} />}

      {done && actions.length > 0 && onNavigate && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <button
              key={action.label + action.view}
              type="button"
              onClick={() => onNavigate(action.view)}
              className="border border-cyan/25 bg-cyan/[0.06] px-2 py-0.5 font-mono text-[0.56rem] tracking-[0.1em] text-cyan/80 transition-colors hover:border-cyan/60 hover:text-cyan"
            >
              → {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function JarvisChat({
  unread = 0,
  onNavigate,
  compact = false,
  autoFocus = false,
}: {
  unread?: number
  onNavigate?: (view: string) => void
  /** The console variant drops the suggestion row once a conversation starts. */
  compact?: boolean
  autoFocus?: boolean
}) {
  const { calm, cue, pushLog, pulseCore, setJarvisSpeaking, settings } = useSystem()
  const { ask, mode } = useJarvisBrain(unread)
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      id: 0,
      role: 'jarvis',
      text: `${MODE_SPEC[mode].greeting} Ich lese Beşiktaş, Fortnite, Entertainment, Reise, Wetter und deine Listen — frag einfach.`,
    },
  ])
  const [draft, setDraft] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processStep, setProcessStep] = useState(0)
  const idRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout)
      stopSpeaking()
    },
    [],
  )

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: calm ? 'auto' : 'smooth' })
  }, [turns.length, processing, calm])

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || processing) return

      setTurns((prev) => [...prev, { id: ++idRef.current, role: 'ali', text: trimmed }])
      setDraft('')
      setProcessing(true)
      setProcessStep(0)
      pulseCore(0.75, 400)
      cue('process')
      pushLog(`Core query: ${trimmed.slice(0, 42)}`, 'core')

      const stepMs = calm ? 90 : 340
      PROCESS_STEPS.forEach((_, i) => {
        if (i === 0) return
        timers.current.push(window.setTimeout(() => setProcessStep(i), i * stepMs))
      })

      // The answer and the "thinking" animation race; whichever is slower wins,
      // so a cached answer still reads as deliberate and a slow module never
      // cuts the animation short.
      const floor = new Promise<void>((resolve) => {
        timers.current.push(window.setTimeout(resolve, PROCESS_STEPS.length * stepMs))
      })

      void Promise.all([ask(trimmed), floor]).then(([result]) => {
        setProcessing(false)
        setTurns((prev) => [
          ...prev,
          { id: ++idRef.current, role: 'jarvis', text: result.say, answer: result, fresh: true },
        ])
        // Only the lead line is spoken — reading a stats grid aloud is noise.
        if (settings.voiceEnabled) {
          speak(result.say, { voiceURI: settings.voiceURI, rate: settings.voiceRate })
        }
      })
    },
    [
      ask,
      calm,
      cue,
      processing,
      pulseCore,
      pushLog,
      settings.voiceEnabled,
      settings.voiceRate,
      settings.voiceURI,
    ],
  )

  const showSuggestions = !compact || turns.length <= 1

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col justify-end space-y-3 overflow-y-auto pr-1"
      >
        {turns.map((turn) =>
          turn.role === 'ali' ? (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.36, ease: EASE.out }}
              className="flex justify-end"
            >
              <div
                className="max-w-[85%] border border-lime/28 bg-lime/[0.06] px-3 py-2 text-[0.84rem] leading-relaxed text-ice/90"
                style={{
                  clipPath:
                    'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                {turn.text}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.36, ease: EASE.out }}
              className="max-w-[95%]"
            >
              <JarvisAnswerBubble
                turn={turn}
                onStart={() => setJarvisSpeaking(true)}
                onEnd={() => setJarvisSpeaking(false)}
                onNavigate={onNavigate}
              />
            </motion.div>
          ),
        )}

        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="max-w-[92%] border border-cyan/20 bg-cyan/[0.04] px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <motion.span
                  className="block h-3 w-3 border border-cyan"
                  animate={calm ? undefined : { rotate: 360 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={processStep}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="font-mono text-[0.66rem] tracking-[0.18em] text-cyan"
                  >
                    {PROCESS_STEPS[processStep]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="mt-2 flex items-end gap-[3px]">
                {Array.from({ length: 22 }, (_, i) => (
                  <motion.span
                    key={i}
                    className="w-[3px] bg-cyan/55"
                    animate={calm ? { height: 4 } : { height: [4, 6 + ((i * 5) % 12), 4] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.045,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showSuggestions && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.slice(0, compact ? 8 : 5).map((s) => (
            <motion.button
              key={s}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => send(s)}
              disabled={processing}
              className="border border-cyan/18 bg-cyan/[0.04] px-2 py-1 font-mono text-[0.56rem] tracking-[0.1em] text-cyan/70 transition-colors hover:border-cyan/45 hover:text-cyan disabled:opacity-40"
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Frag RonalJarvis..."
          aria-label="Frage an RonalJarvis"
          disabled={processing}
          className="hud-input flex-1 py-2 text-[0.84rem]"
          style={{ letterSpacing: 'normal' }}
        />
        <HudButton type="submit" variant="primary" small busy={processing} disabled={!draft.trim()}>
          Senden
        </HudButton>
      </form>
    </div>
  )
}
