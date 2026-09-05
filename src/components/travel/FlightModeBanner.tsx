import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { TRIP } from '../../lib/config'

/**
 * Requirement: on the day of the flight the OS visibly changes character.
 * This is the transition cinematic — INITIALIZING, then ACTIVE — followed by a
 * persistent strip that stays for the whole flight-day / in-flight window.
 */
export function FlightModeCinematic({ onDone }: { onDone: () => void }) {
  const { calm, cue, pushLog } = useSystem()
  const [stage, setStage] = useState<'init' | 'active'>('init')

  useEffect(() => {
    cue('process')
    pushLog('FLIGHT MODE initializing', 'warn')
    const t1 = window.setTimeout(() => {
      setStage('active')
      cue('confirm')
      pushLog('FLIGHT MODE active', 'core')
    }, calm ? 400 : 1900)
    const t2 = window.setTimeout(onDone, calm ? 900 : 3800)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-void/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: EASE.out }}
    >
      {/* runway lights streaking past */}
      {!calm &&
        Array.from({ length: 14 }, (_, i) => (
          <motion.span
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-amber to-transparent"
            style={{ top: `${8 + i * 6.4}%`, width: '38%' }}
            initial={{ x: '-140%', opacity: 0 }}
            animate={{ x: '340%', opacity: [0, 0.8, 0] }}
            transition={{
              duration: 1.15,
              repeat: Infinity,
              delay: i * 0.09,
              ease: 'linear',
            }}
          />
        ))}

      <div className="relative z-10 px-6 text-center">
        <AnimatePresence mode="wait">
          {stage === 'init' ? (
            <motion.div
              key="init"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: EASE.out }}
            >
              <div className="font-display text-lg font-black tracking-[0.24em] text-amber sm:text-2xl">
                FLIGHT MODE INITIALIZING
                <span className="jv-blink ml-1">...</span>
              </div>
              <div className="mx-auto mt-4 h-px w-56 overflow-hidden bg-amber/20">
                <motion.div
                  className="h-full bg-amber"
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: calm ? 0.3 : 1.8, ease: 'linear' }}
                />
              </div>
              <div className="mt-4 space-y-1 font-mono text-[0.6rem] tracking-[0.22em] text-amber/60">
                <div>ARMING BOARDING PASS · GATE {TRIP.gate}</div>
                <div>SYNCING DEPARTURE TELEMETRY</div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(12px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.5, ease: EASE.out }}
            >
              <div className="font-display text-2xl font-black tracking-[0.26em] text-amber sm:text-4xl"
                style={{ textShadow: '0 0 18px rgba(255,181,77,0.8), 0 0 60px rgba(255,181,77,0.35)' }}
              >
                FLIGHT MODE ACTIVE
              </div>
              <motion.div
                className="mx-auto mt-4 h-px bg-amber"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: EASE.out }}
              />
              <div className="mt-3 font-mono text-[0.62rem] tracking-[0.3em] text-amber/70">
                {TRIP.flightNumber} · SEAT {TRIP.seat} · TERMINAL {TRIP.terminal}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/** Persistent strip while flight mode is on. */
export function FlightModeStrip({ inFlight }: { inFlight: boolean }) {
  const { fx } = useSystem()
  return (
    <motion.div
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.5, ease: EASE.out }}
      className="relative overflow-hidden border-b border-amber/30 bg-amber/[0.06]"
    >
      {fx.microPulses && (
        <motion.div
          className="absolute inset-y-0 w-1/3"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,181,77,0.18), transparent)',
          }}
          animate={{ x: ['-120%', '320%'] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div className="relative flex items-center justify-center gap-3 px-4 py-1.5 font-display text-[0.58rem] font-black tracking-[0.26em] text-amber">
        <motion.span
          className="h-1.5 w-1.5 rotate-45 bg-amber"
          animate={fx.microPulses ? { opacity: [1, 0.2, 1] } : undefined}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        {inFlight ? 'IN FLIGHT — RJ-2317 EN ROUTE TO DALAMAN' : 'FLIGHT MODE ACTIVE — DEPARTURE TODAY'}
        <motion.span
          className="h-1.5 w-1.5 rotate-45 bg-amber"
          animate={fx.microPulses ? { opacity: [1, 0.2, 1] } : undefined}
          transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }}
        />
      </div>
    </motion.div>
  )
}
