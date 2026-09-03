import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { authProvider, type JarvisSession } from '../../lib/auth'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { HudButton } from '../hud/HudButton'
import { ScannerRing, type ScannerState } from './ScannerRing'

/** The scan narration. Each step holds for `hold` ms. */
const SCAN_STEPS = [
  { text: 'SCANNING IDENTITY...', hold: 780 },
  { text: 'USER SIGNATURE DETECTED', hold: 700 },
  { text: 'MATCHING PROFILE...', hold: 780 },
  { text: 'AUTHENTICATION...', hold: 740 },
] as const

type Phase = 'input' | 'scanning' | 'granted' | 'confirmed' | 'denied'

export function AuthGate({ onAuthorized }: { onAuthorized: (s: JarvisSession) => void }) {
  const { calm, cue, pushLog, pulseCore } = useSystem()
  const [passcode, setPasscode] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timers = useRef<number[]>([])

  const speed = calm ? 0.35 : 1

  useEffect(() => {
    inputRef.current?.focus()
    return () => timers.current.forEach(window.clearTimeout)
  }, [])

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms * speed))
  }

  const runScan = useCallback(
    async () => {
      if (phase === 'scanning') return
      setError(null)
      setPhase('scanning')
      setStep(0)
      cue('scan')
      pushLog('Identity scan requested', 'core')

      // Narration runs on its own clock…
      let elapsed = 0
      SCAN_STEPS.forEach((_, i) => {
        if (i === 0) return
        elapsed += SCAN_STEPS[i - 1].hold
        schedule(() => {
          setStep(i)
          cue('boot-line')
        }, elapsed)
      })
      const narrationMs =
        SCAN_STEPS.reduce((sum, s) => sum + s.hold, 0) * speed

      // …while the real credential check runs in parallel.
      const startedAt = performance.now()
      const result = await authProvider.signIn(passcode)
      const wait = Math.max(0, narrationMs - (performance.now() - startedAt))

      window.setTimeout(() => {
        if (result.ok) {
          setPhase('granted')
          cue('confirm')
          pulseCore(1, 700)
          pushLog(`Identity confirmed — ${result.session.displayName}`, 'ok')
          schedule(() => setPhase('confirmed'), 1150)
          schedule(() => onAuthorized(result.session), 2950)
        } else {
          setPhase('denied')
          setError(result.message)
          cue('deny')
          pushLog('Identity scan rejected', 'warn')
          schedule(() => {
            setPhase('input')
            setPasscode('')
            inputRef.current?.focus()
          }, 1500)
        }
      }, wait)
    },
    [cue, onAuthorized, passcode, phase, pulseCore, pushLog, speed],
  )

  const scannerState: ScannerState =
    phase === 'scanning'
      ? 'scanning'
      : phase === 'granted' || phase === 'confirmed'
        ? 'granted'
        : phase === 'denied'
          ? 'denied'
          : 'idle'

  const progress =
    phase === 'granted' || phase === 'confirmed'
      ? 100
      : phase === 'denied'
        ? 68
        : phase === 'scanning'
          ? ((step + 1) / SCAN_STEPS.length) * 92
          : Math.min(28, passcode.length * 3.4)

  return (
    <motion.div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: EASE.out }}
    >
      {/* success flood light */}
      <AnimatePresence>
        {(phase === 'granted' || phase === 'confirmed') && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.12] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(124,255,155,0.45), rgba(53,230,255,0.22) 40%, transparent 72%)',
              mixBlendMode: 'screen',
            }}
          />
        )}
        {phase === 'denied' && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-40 bg-danger/15"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative z-10 w-full max-w-lg"
        animate={
          phase === 'denied' && !calm
            ? { x: [0, -9, 8, -6, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.42 }}
      >
        <div className="panel panel-cut relative overflow-hidden">
          {!calm && <div className="edge-shimmer" />}

          <header className="flex items-center justify-between border-b border-cyan/15 bg-gradient-to-r from-cyan/10 to-transparent px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rotate-45 bg-cyan shadow-[0_0_8px_#35e6ff]" />
              <span className="hud-label">Identity Gate</span>
            </div>
            <span className="font-mono text-[0.58rem] tracking-[0.2em] text-cyan/55">
              {authProvider.label}
            </span>
          </header>

          <div className="flex flex-col items-center px-5 py-7 sm:px-8">
            <ScannerRing state={scannerState} progress={progress} size={252} />

            {/* narration / result stack */}
            <div className="mt-5 min-h-[9.5rem] w-full text-center">
              <AnimatePresence mode="wait">
                {phase === 'input' && (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3, ease: EASE.out }}
                    className="space-y-4"
                  >
                    <div>
                      <h1 className="font-display text-lg font-black tracking-[0.22em] text-ice text-glow">
                        IDENTITÄT BESTÄTIGEN
                      </h1>
                      <p className="mt-1.5 font-mono text-[0.62rem] tracking-[0.22em] text-cyan/50">
                        SIGNATURKODE EINGEBEN
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void runScan()
                      }}
                      className="space-y-3"
                    >
                      <div className="relative">
                        <input
                          ref={inputRef}
                          type="password"
                          value={passcode}
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck={false}
                          inputMode="text"
                          aria-label="Signaturkode"
                          onChange={(e) => {
                            setPasscode(e.target.value)
                            setError(null)
                            cue('key')
                          }}
                          className="hud-input text-center"
                          placeholder="••••••••"
                        />
                        {/* per-character segment readout */}
                        <div className="pointer-events-none absolute -bottom-2 left-0 right-0 flex justify-center gap-1">
                          {Array.from({ length: 10 }, (_, i) => (
                            <motion.span
                              key={i}
                              className="h-px w-4"
                              initial={false}
                              animate={{
                                backgroundColor:
                                  i < passcode.length
                                    ? 'rgba(53,230,255,0.95)'
                                    : 'rgba(53,230,255,0.16)',
                                scaleX: i < passcode.length ? 1 : 0.6,
                              }}
                              transition={{ duration: 0.2 }}
                            />
                          ))}
                        </div>
                      </div>

                      <HudButton
                        type="submit"
                        variant="primary"
                        className="w-full"
                        disabled={!passcode}
                      >
                        Identität bestätigen
                      </HudButton>
                    </form>
                  </motion.div>
                )}

                {phase === 'scanning' && (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 pt-2"
                  >
                    {SCAN_STEPS.map((s, i) => (
                      <AnimatePresence key={s.text}>
                        {i <= step && (
                          <motion.div
                            initial={{ opacity: 0, x: -14, filter: 'blur(4px)' }}
                            animate={{
                              opacity: i === step ? 1 : 0.42,
                              x: 0,
                              filter: 'blur(0px)',
                            }}
                            transition={{ duration: 0.34, ease: EASE.out }}
                            className="flex items-center justify-center gap-2 font-mono text-[0.76rem] tracking-[0.16em] text-cyan"
                          >
                            <span className="text-cyan/40">&gt;</span>
                            {s.text}
                            {i === step && (
                              <span className="jv-blink inline-block h-3 w-1.5 bg-cyan" />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                  </motion.div>
                )}

                {phase === 'granted' && (
                  <motion.div
                    key="granted"
                    initial={{ opacity: 0, scale: 0.86, filter: 'blur(12px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.08 }}
                    transition={{ duration: 0.42, ease: EASE.out }}
                    className="pt-6"
                  >
                    <div className="font-display text-2xl font-black tracking-[0.24em] text-lime text-glow-lime sm:text-3xl">
                      ACCESS GRANTED
                    </div>
                    <motion.div
                      className="mx-auto mt-3 h-px bg-lime"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.55, ease: EASE.out }}
                    />
                  </motion.div>
                )}

                {phase === 'confirmed' && (
                  <motion.div
                    key="confirmed"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: EASE.out }}
                    className="pt-3 text-left"
                  >
                    <div className="mb-3 text-center font-display text-base font-black tracking-[0.3em] text-ice text-glow-strong">
                      IDENTITY CONFIRMED
                    </div>
                    <div className="mx-auto max-w-xs space-y-1.5 border border-lime/25 bg-lime/[0.04] p-3">
                      {[
                        ['USER', 'ALI'],
                        ['ACCESS LEVEL', 'BROTHER'],
                        ['STATUS', 'AUTHORIZED'],
                      ].map(([k, v], i) => (
                        <motion.div
                          key={k}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.16, duration: 0.35, ease: EASE.out }}
                          className="flex items-baseline justify-between gap-3 font-mono text-[0.72rem]"
                        >
                          <span className="tracking-[0.16em] text-cyan/55">{k}</span>
                          <span className="font-display text-[0.8rem] font-bold tracking-[0.16em] text-lime text-glow-lime">
                            {v}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.85 }}
                      className="mt-3 text-center font-mono text-[0.6rem] tracking-[0.28em] text-cyan/55"
                    >
                      WILLKOMMEN ZURÜCK, ALI
                    </motion.div>
                  </motion.div>
                )}

                {phase === 'denied' && (
                  <motion.div
                    key="denied"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="pt-6"
                  >
                    <div className="font-display text-xl font-black tracking-[0.24em] text-danger">
                      ACCESS DENIED
                    </div>
                    <div className="mt-2 font-mono text-[0.66rem] tracking-[0.14em] text-danger/75">
                      {error ?? 'SIGNATURE MISMATCH'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-cyan/12 px-5 py-2.5 font-mono text-[0.55rem] tracking-[0.2em] text-cyan/35">
            <span>RJV-SEC / LOCAL ENCLAVE</span>
            <span className="jv-blink">● GATE ARMED</span>
          </footer>
        </div>

        <p className="mt-4 text-center font-mono text-[0.55rem] leading-relaxed tracking-[0.16em] text-cyan/25">
          DEMO-GATE — SPÄTER ERSETZBAR DURCH SUPABASE / FIREBASE AUTH
        </p>
      </motion.div>
    </motion.div>
  )
}
