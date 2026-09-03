import { motion } from 'framer-motion'
import { useSystem } from '../state/SystemProvider'
import { PHASE_LABEL, TRIP } from '../lib/config'
import { useCountdown } from '../lib/hooks'
import { JarvisCore } from '../components/core/JarvisCore'
import { HoloCard } from '../components/hud/HoloCard'
import { StatusPill } from '../components/hud/Readout'
import { JarvisChat } from '../components/jarvis/JarvisChat'
import { SystemLog } from '../components/sim/SystemLog'
import { SystemMonitor } from '../components/sim/SystemMonitor'
import { Radar } from '../components/sim/Radar'
import { WeatherPanel } from '../components/weather/WeatherPanel'
import { Countdown } from '../components/travel/Countdown'
import { POIS, KIND_TONE } from '../data/marmaris'
import type { JarvisSession } from '../lib/auth'
import { EASE } from '../lib/motion'

export function HomeView({ session }: { session: JarvisSession }) {
  const { phase, stats, calm } = useSystem()
  const countdown = useCountdown(TRIP.departure)
  const flightMode = phase === 'flight_day' || phase === 'in_flight'

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* ---------------------------------------------------------- core hero */}
      <HoloCard
        index={0}
        tone="cyan"
        className="lg:col-span-5"
        bodyClassName="p-0"
        title="RonalJarvis Core"
        status="ACTIVE"
        scan
        flat
      >
        <div className="flex flex-col items-center px-4 pb-6 pt-3">
          <JarvisCore size={268} caption="RJV CORE // ALI-PRIME" />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: EASE.out }}
            className="mt-6 text-center"
          >
            <div className="hud-label mb-1">Operator</div>
            <div className="font-display text-xl font-black tracking-[0.2em] text-ice text-glow">
              {session.displayName}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <StatusPill tone="lime">{session.accessLevel}</StatusPill>
              <StatusPill tone={flightMode ? 'amber' : 'cyan'}>{PHASE_LABEL[phase]}</StatusPill>
            </div>
          </motion.div>
        </div>
      </HoloCard>

      {/* ---------------------------------------------------------- countdown */}
      <div className="grid grid-cols-1 gap-3 lg:col-span-7 lg:grid-rows-[auto_1fr]">
        <HoloCard
          index={1}
          tone={flightMode ? 'amber' : 'cyan'}
          title={flightMode ? 'Departure Imminent' : 'Mission Countdown'}
          status={TRIP.flightNumber}
          scan
        >
          <div className="py-2">
            <Countdown size={flightMode ? 'xl' : 'lg'} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-cyan/10 pt-3 sm:grid-cols-4">
            {[
              ['ABFLUG', TRIP.departure.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
              ['ANKUNFT', TRIP.arrival.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
              ['GATE', `${TRIP.gate} · T${TRIP.terminal}`],
              ['SITZ', TRIP.seat],
            ].map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07, duration: 0.4 }}
              >
                <div className="hud-label mb-0.5">{k}</div>
                <div className="font-display text-[0.76rem] font-bold tracking-[0.06em] text-ice">
                  {v}
                </div>
              </motion.div>
            ))}
          </div>
        </HoloCard>

        {/* --------------------------------------------------------- jarvis chat */}
        <HoloCard
          index={2}
          tone="cyan"
          title="Core Dialogue"
          status={`${stats.cpu}% LOAD`}
          bodyClassName="p-4"
        >
          <JarvisChat />
        </HoloCard>
      </div>

      {/* ------------------------------------------------------------- monitor */}
      <div className="lg:col-span-4">
        <SystemMonitor index={3} />
      </div>

      {/* ------------------------------------------------------------- weather */}
      <div className="lg:col-span-4">
        <WeatherPanel index={4} />
      </div>

      {/* --------------------------------------------------------------- radar */}
      <HoloCard
        index={5}
        tone="lime"
        title="Marmaris Area Scan"
        status="SWEEP"
        className="lg:col-span-4"
        bodyClassName="p-4"
      >
        <Radar
          markers={POIS.slice(0, 5).map((p) => ({
            label: p.short,
            angle: p.bearing,
            dist: p.radar,
            tone: KIND_TONE[p.kind],
          }))}
          size={210}
          label="RANGE 45 KM"
        />
        <div className="mt-4 space-y-1.5 border-t border-cyan/10 pt-3">
          {POIS.slice(0, 3).map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.35 }}
              className="flex items-center justify-between gap-2 font-mono text-[0.6rem]"
            >
              <span className="truncate text-cyan/70">{p.name}</span>
              <span className="shrink-0 tabular-nums text-ice/70">
                {p.distanceKm.toFixed(1)} KM
              </span>
            </motion.div>
          ))}
        </div>
      </HoloCard>

      {/* ----------------------------------------------------------- terminal */}
      <div className="lg:col-span-8">
        <SystemLog index={6} visibleCount={7} />
      </div>

      {/* -------------------------------------------------------- quick facts */}
      <HoloCard
        index={7}
        tone="violet"
        title="Mission Digest"
        status="AUTO"
        className="lg:col-span-4"
      >
        <ul className="space-y-2.5 text-[0.8rem] leading-relaxed text-ice/75">
          {[
            `Countdown bei T–${countdown.days} Tagen, ${String(countdown.hours).padStart(2, '0')} Stunden.`,
            `Route ${TRIP.distanceKm} km, Flugzeit ca. ${Math.round(
              (TRIP.arrival.getTime() - TRIP.departure.getTime()) / 3_600_000,
            )} h.`,
            'Entertainment-Index synchronisiert, 4 Titel offline.',
            'Privater Kanal zu Tony verschlüsselt und aktiv.',
          ].map((line, i) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.09, duration: 0.4 }}
              className="flex gap-2"
            >
              <motion.span
                className="mt-1.5 h-1 w-1 shrink-0 rotate-45 bg-violet"
                animate={calm ? undefined : { opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
              />
              <span>{line}</span>
            </motion.li>
          ))}
        </ul>
      </HoloCard>
    </div>
  )
}
