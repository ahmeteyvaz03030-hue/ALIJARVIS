import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { EASE } from '../../lib/motion'
import { SegmentBar } from '../hud/Readout'

const MODULES = [
  { name: 'TRAVEL MODULE', code: 'FLGT' },
  { name: 'WEATHER MODULE', code: 'ATMO' },
  { name: 'GEO INTEL / MARMARIS', code: 'GEO' },
  { name: 'ENTERTAINMENT MODULE', code: 'ENT' },
  { name: 'TONY COMMS', code: 'COM' },
  { name: 'CORE HEURISTICS', code: 'CORE' },
]

/**
 * Post-authentication hand-off (requirement: the dashboard must never simply
 * appear). Modules report in one at a time, then the OS declares itself
 * operational and the desktop rails in behind it.
 */
export function UnlockSequence({ onComplete }: { onComplete: () => void }) {
  const { calm, cue, pushLog, pulseCore } = useSystem()
  const [online, setOnline] = useState(0)
  const [operational, setOperational] = useState(false)

  const step = calm ? 90 : 265

  useEffect(() => {
    cue('unlock')
    pulseCore(0.9, 900)
    const timers: number[] = []
    MODULES.forEach((mod, i) => {
      timers.push(
        window.setTimeout(
          () => {
            setOnline(i + 1)
            cue('panel')
            pushLog(`${mod.name} online`, 'ok')
          },
          (calm ? 120 : 520) + i * step,
        ),
      )
    })
    timers.push(
      window.setTimeout(
        () => {
          setOperational(true)
          cue('confirm')
        },
        (calm ? 120 : 520) + MODULES.length * step + 120,
      ),
    )
    timers.push(
      window.setTimeout(onComplete, (calm ? 480 : 520) + MODULES.length * step + (calm ? 300 : 1250)),
    )
    return () => timers.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progress = Math.round((online / MODULES.length) * 100)

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-void/94 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: EASE.out }}
    >
      {/* expanding unlock shockwave */}
      {!calm &&
        [0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/40"
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 14, opacity: 0 }}
            transition={{ duration: 2.4, delay: i * 0.28, ease: 'easeOut' }}
          />
        ))}

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.22em' }}
          transition={{ duration: 0.75, ease: EASE.out }}
          className="mb-1 text-center font-display text-base font-black text-ice text-glow-strong sm:text-xl"
        >
          RONALJARVIS SYSTEM UNLOCKED
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mb-6 text-center font-mono text-[0.62rem] tracking-[0.32em] text-cyan/60"
        >
          LOADING MODULES...
          <span className="jv-blink ml-1 inline-block h-3 w-1.5 translate-y-[2px] bg-cyan" />
        </motion.div>

        <div className="space-y-1.5">
          {MODULES.map((mod, i) => {
            const isOnline = i < online
            return (
              <motion.div
                key={mod.code}
                initial={{ opacity: 0, x: -22 }}
                animate={{ opacity: isOnline ? 1 : 0.28, x: 0 }}
                transition={{ duration: 0.42, ease: EASE.out, delay: i * 0.04 }}
                className="relative border px-3 py-2"
                style={{
                  borderColor: isOnline ? 'rgba(124,255,155,0.3)' : 'rgba(53,230,255,0.12)',
                  background: isOnline ? 'rgba(124,255,155,0.05)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="h-1.5 w-1.5 rotate-45"
                      animate={{
                        backgroundColor: isOnline ? '#7cff9b' : 'rgba(53,230,255,0.3)',
                        boxShadow: isOnline ? '0 0 8px #7cff9b' : 'none',
                      }}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="font-display text-[0.62rem] font-bold tracking-[0.16em] text-ice/90">
                      {mod.name}
                    </span>
                  </div>
                  <AnimatePresence>
                    {isOnline ? (
                      <motion.span
                        key="on"
                        initial={{ opacity: 0, scale: 1.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: EASE.out }}
                        className="font-display text-[0.55rem] font-black tracking-[0.22em] text-lime text-glow-lime"
                      >
                        ONLINE
                      </motion.span>
                    ) : (
                      <span
                        key="off"
                        className="font-mono text-[0.55rem] tracking-[0.18em] text-cyan/30"
                      >
                        ····
                      </span>
                    )}
                  </AnimatePresence>
                </div>
                {/* fill sweep on activation */}
                {isOnline && !calm && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-lime/12"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: [0, 1, 0], originX: [0, 0, 1] }}
                    transition={{ duration: 0.7, ease: EASE.out }}
                  />
                )}
              </motion.div>
            )
          })}
        </div>

        <div className="mt-6">
          <SegmentBar value={progress} segments={24} tone={operational ? 'lime' : 'cyan'} />
        </div>

        <div className="mt-5 h-8 text-center">
          <AnimatePresence>
            {operational && (
              <motion.div
                initial={{ opacity: 0, scale: 0.88, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: EASE.out }}
                className="font-display text-sm font-black tracking-[0.3em] text-lime text-glow-lime sm:text-base"
              >
                ALL SYSTEMS OPERATIONAL
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
