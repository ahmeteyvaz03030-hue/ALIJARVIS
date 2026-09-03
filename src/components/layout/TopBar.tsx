import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { PHASE_LABEL, TRIP } from '../../lib/config'
import type { JarvisSession } from '../../lib/auth'
import { IconMotion, IconPower, IconSound } from './Icons'
import { StatusPill } from '../hud/Readout'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: number
    const tick = () => {
      setNow(new Date())
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timer)
  }, [])
  return now
}

/** Scrolling telemetry strip — pure transform, so it is nearly free. */
function Ticker() {
  const { stats, phase, calm } = useSystem()
  const items = useMemo(
    () => [
      `FLIGHT ${TRIP.flightNumber}`,
      `PHASE ${PHASE_LABEL[phase]}`,
      `NET ${stats.network}%`,
      `PING ${stats.ping}MS`,
      `CPU ${stats.cpu}%`,
      `TRAVEL DB ${stats.travelDb}`,
      `MARMARIS ${stats.marmarisDb}`,
      `TONY LINK ${stats.tonyLink}`,
      'SYSTEM STATUS OPTIMAL',
    ],
    [stats, phase],
  )
  const strip = items.join('   ///   ')

  if (calm) {
    return (
      <div className="truncate font-mono text-[0.58rem] tracking-[0.18em] text-cyan/45">
        {strip}
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage:
          'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <motion.div
        className="flex whitespace-nowrap font-mono text-[0.58rem] tracking-[0.18em] text-cyan/45"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 42, repeat: Infinity, ease: 'linear' }}
        style={{ willChange: 'transform' }}
      >
        <span className="pr-8">{strip}</span>
        <span className="pr-8">{strip}</span>
      </motion.div>
    </div>
  )
}

export function TopBar({
  session,
  onSignOut,
}: {
  session: JarvisSession
  onSignOut: () => void
}) {
  const { settings, patchSettings, phase, calm, cue } = useSystem()
  const now = useClock()

  const toggle = (patch: Parameters<typeof patchSettings>[0], sound = true) => {
    patchSettings(patch)
    if (sound) cue('nav')
  }

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 border-b border-cyan/15 bg-void/80 backdrop-blur-md"
    >
      <div className="relative flex items-center gap-3 px-3 py-2 sm:gap-5 sm:px-5">
        {/* wordmark */}
        <div className="flex shrink-0 items-center gap-2.5">
          <motion.span
            className="relative block h-6 w-6"
            animate={calm ? undefined : { rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          >
            <span className="absolute inset-0 rounded-full border border-cyan/40" />
            <span className="absolute inset-1 rounded-full border border-dashed border-cyan/60" />
            <span className="absolute inset-[9px] rounded-full bg-cyan shadow-[0_0_10px_#35e6ff]" />
          </motion.span>
          <div className="leading-none">
            <div className="font-display text-[0.78rem] font-black tracking-[0.18em] text-ice">
              RONAL<span className="text-cyan">JARVIS</span>
            </div>
            <div className="mt-0.5 hidden font-mono text-[0.5rem] tracking-[0.24em] text-cyan/40 sm:block">
              PERSONAL INTELLIGENCE OS
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="hidden min-w-0 flex-1 md:block">
          <Ticker />
        </div>

        {/* right cluster */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <StatusPill tone={phase === 'arrived' ? 'lime' : phase === 'flight_day' || phase === 'in_flight' ? 'amber' : 'cyan'}>
              {PHASE_LABEL[phase]}
            </StatusPill>
          </div>

          <div className="text-right leading-none">
            <div className="font-display text-[0.82rem] font-bold tabular-nums tracking-[0.1em] text-ice">
              {now.toTimeString().slice(0, 8)}
            </div>
            <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.16em] text-cyan/40">
              {now.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).toUpperCase()}
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-cyan/12 pl-2 sm:pl-3">
            <IconToggle
              active={settings.sound}
              label={settings.sound ? 'Ton aus' : 'Ton an'}
              onClick={() => toggle({ sound: !settings.sound })}
            >
              <IconSound muted={!settings.sound} />
            </IconToggle>
            <IconToggle
              active={!calm}
              label={calm ? 'Volle Animationen' : 'Reduce Motion'}
              onClick={() => toggle({ motion: calm ? 'full' : 'calm' })}
            >
              <IconMotion />
            </IconToggle>
            <IconToggle active={false} label="Abmelden" onClick={onSignOut} tone="danger">
              <IconPower />
            </IconToggle>
          </div>

          <div className="hidden items-center gap-2 border-l border-cyan/12 pl-3 lg:flex">
            <div className="text-right leading-none">
              <div className="font-display text-[0.7rem] font-bold tracking-[0.16em] text-ice">
                {session.displayName}
              </div>
              <div className="mt-0.5 font-mono text-[0.5rem] tracking-[0.18em] text-lime/70">
                {session.accessLevel}
              </div>
            </div>
            <span className="relative flex h-7 w-7 items-center justify-center border border-lime/40 bg-lime/10 font-display text-[0.6rem] font-black text-lime">
              {session.displayName.slice(0, 2)}
              {!calm && (
                <motion.span
                  className="absolute inset-0 border border-lime/60"
                  animate={{ opacity: [0.8, 0, 0.8], scale: [1, 1.3, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </span>
          </div>
        </div>
      </div>

      {/* mobile ticker row */}
      <div className="border-t border-cyan/10 px-3 py-1 md:hidden">
        <Ticker />
      </div>
    </motion.header>
  )
}

function IconToggle({
  children,
  active,
  label,
  onClick,
  tone = 'cyan',
}: {
  children: React.ReactNode
  active: boolean
  label: string
  onClick: () => void
  tone?: 'cyan' | 'danger'
}) {
  const rgb = tone === 'danger' ? '255,90,110' : '53,230,255'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      whileHover={{ y: -1, scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className="flex h-7 w-7 items-center justify-center border transition-colors"
      style={{
        borderColor: `rgba(${rgb},${active ? 0.6 : 0.2})`,
        color: `rgba(${rgb},${active ? 1 : 0.5})`,
        background: active ? `rgba(${rgb},0.12)` : 'transparent',
      }}
    >
      {children}
    </motion.button>
  )
}
