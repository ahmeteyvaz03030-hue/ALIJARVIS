import { Suspense, lazy, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSystem } from '../state/SystemProvider'
import { ARRIVAL_AIRPORT, ORIGIN, TRIP } from '../lib/config'
import { useCountdown } from '../lib/hooks'
import { EASE } from '../lib/motion'
import { HoloCard } from '../components/hud/HoloCard'
import { AnimatedNumber, SegmentBar, StatusPill } from '../components/hud/Readout'
import { Countdown } from '../components/travel/Countdown'
import { FlightRoute } from '../components/travel/FlightRoute'

/** three.js stays out of the initial bundle. */
const Globe3D = lazy(() => import('../components/travel/Globe3D'))

function GlobeFallback() {
  return (
    <div className="flex h-[340px] flex-col items-center justify-center gap-3">
      <motion.div
        className="h-10 w-10 rounded-full border border-cyan/25 border-t-cyan"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="font-mono text-[0.58rem] tracking-[0.26em] text-cyan/50">
        SPINNING UP ORBITAL VIEW
      </span>
    </div>
  )
}

/** Live-ish flight telemetry while airborne. */
function useFlightProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const compute = () => {
      const dep = TRIP.departure.getTime()
      const arr = TRIP.arrival.getTime()
      const now = Date.now()
      setProgress(Math.min(1, Math.max(0, (now - dep) / (arr - dep))))
    }
    compute()
    const timer = window.setInterval(compute, 5000)
    return () => window.clearInterval(timer)
  }, [])
  return progress
}

export function TravelView() {
  const { phase, calm } = useSystem()
  const countdown = useCountdown(TRIP.departure)
  const progress = useFlightProgress()
  const inFlight = phase === 'in_flight'
  const flightHours = (TRIP.arrival.getTime() - TRIP.departure.getTime()) / 3_600_000

  const altitude = inFlight
    ? Math.round(TRIP.cruiseAltitudeFt * Math.min(1, Math.sin(Math.PI * progress) * 1.6))
    : 0
  const speed = inFlight
    ? Math.round(TRIP.cruiseSpeedKmh * Math.min(1, Math.sin(Math.PI * progress) * 1.9))
    : 0
  const remainingKm = Math.round(TRIP.distanceKm * (1 - progress))

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* -------------------------------------------------------- route map */}
      <HoloCard
        index={0}
        tone={inFlight ? 'amber' : 'cyan'}
        title="Flight Path Simulation"
        status={inFlight ? 'EN ROUTE' : 'ROUTE CALCULATED'}
        className="lg:col-span-8"
        scan
        flat
      >
        <FlightRoute progress={progress} />
      </HoloCard>

      {/* --------------------------------------------------------- countdown */}
      <div className="grid grid-cols-1 gap-3 lg:col-span-4 lg:grid-rows-[auto_1fr]">
        <HoloCard
          index={1}
          tone={inFlight ? 'amber' : 'cyan'}
          title={inFlight ? 'Time To Touchdown' : 'Departure In'}
          status={TRIP.flightNumber}
        >
          <div className="py-3">
            <Countdown
              target={inFlight ? TRIP.arrival : TRIP.departure}
              size="md"
              prefix={inFlight ? 'T–' : 'T–'}
            />
          </div>
        </HoloCard>

        <HoloCard index={2} tone="cyan" title="Boarding Pass" status="ARMED">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="hud-label mb-0.5">From</div>
                <div className="font-display text-2xl font-black tracking-[0.1em] text-ice">
                  {ORIGIN.code}
                </div>
                <div className="font-mono text-[0.55rem] tracking-[0.16em] text-cyan/50">
                  {ORIGIN.city}
                </div>
              </div>
              <div className="relative flex-1 px-2">
                <div className="h-px bg-gradient-to-r from-cyan/20 via-cyan/60 to-cyan/20" />
                <motion.span
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-cyan"
                  animate={calm ? undefined : { left: ['0%', '100%'] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13.5l18-7-4.2 8.4L21 21l-6.6-3.2-2.9 3.4-.6-4.6L3 13.5z" />
                  </svg>
                </motion.span>
              </div>
              <div className="text-right">
                <div className="hud-label mb-0.5">To</div>
                <div className="font-display text-2xl font-black tracking-[0.1em] text-lime">
                  {ARRIVAL_AIRPORT.code}
                </div>
                <div className="font-mono text-[0.55rem] tracking-[0.16em] text-lime/60">
                  {ARRIVAL_AIRPORT.name}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-cyan/10 pt-2.5">
              {[
                ['GATE', TRIP.gate],
                ['TERMINAL', TRIP.terminal],
                ['SITZ', TRIP.seat],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="hud-label mb-0.5">{k}</div>
                  <div className="font-display text-[0.8rem] font-bold text-ice">{v}</div>
                </div>
              ))}
            </div>

            {/* barcode strip */}
            <div className="flex h-7 items-stretch gap-[2px] border-t border-cyan/10 pt-2.5">
              {Array.from({ length: 48 }, (_, i) => (
                <span
                  key={i}
                  className="bg-cyan/60"
                  style={{ width: (i * 7) % 3 === 0 ? 3 : 1, opacity: (i * 5) % 4 === 0 ? 0.3 : 0.7 }}
                />
              ))}
            </div>
          </div>
        </HoloCard>
      </div>

      {/* ------------------------------------------------------------ globe */}
      <HoloCard
        index={3}
        tone="cyan"
        title="Orbital View · Germany → Türkiye"
        status="3D"
        className="lg:col-span-7"
        bodyClassName="p-0"
        flat
      >
        <Suspense fallback={<GlobeFallback />}>
          <Globe3D height={340} />
        </Suspense>
      </HoloCard>

      {/* -------------------------------------------------------- telemetry */}
      <HoloCard
        index={4}
        tone={inFlight ? 'amber' : 'cyan'}
        title="Flight Telemetry"
        status={inFlight ? 'LIVE' : 'STANDBY'}
        className="lg:col-span-5"
        scan={inFlight}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="hud-label">Streckenfortschritt</span>
              <span className="font-mono text-[0.7rem] tabular-nums text-cyan">
                <AnimatedNumber value={progress * 100} decimals={1} suffix="%" />
              </span>
            </div>
            <SegmentBar value={progress * 100} segments={22} tone={inFlight ? 'amber' : 'cyan'} />
            <div className="mt-1.5 flex justify-between font-mono text-[0.55rem] tracking-[0.14em] text-cyan/40">
              <span>{ORIGIN.code}</span>
              <span>{remainingKm} KM REMAINING</span>
              <span>{ARRIVAL_AIRPORT.code}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'HÖHE', v: altitude, s: ' FT' },
              { k: 'GESCHWINDIGKEIT', v: speed, s: ' KM/H' },
              { k: 'FLUGZEIT', v: flightHours, s: ' H', d: 1 },
              { k: 'DISTANZ', v: TRIP.distanceKm, s: ' KM' },
            ].map((cell) => (
              <div key={cell.k} className="border border-cyan/12 bg-cyan/[0.03] p-2.5">
                <div className="hud-label mb-1">{cell.k}</div>
                <div className="font-display text-base font-bold tabular-nums text-ice">
                  <AnimatedNumber value={cell.v} decimals={cell.d ?? 0} suffix={cell.s} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-cyan/10 pt-3">
            <span className="hud-label">Status</span>
            <StatusPill tone={inFlight ? 'amber' : phase === 'arrived' ? 'lime' : 'cyan'}>
              {inFlight
                ? 'AIRBORNE'
                : phase === 'arrived'
                  ? 'LANDED'
                  : `T–${countdown.days}D ${String(countdown.hours).padStart(2, '0')}H`}
            </StatusPill>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: EASE.out }}
            className="text-[0.76rem] leading-relaxed text-ice/60"
          >
            {inFlight
              ? 'RJ-2317 befindet sich im Reiseflug. Telemetrie wird alle 5 Sekunden aktualisiert.'
              : 'Route berechnet und im Cache. RonalJarvis überwacht Gate-, Wetter- und Verspätungsdaten automatisch.'}
          </motion.p>
        </div>
      </HoloCard>
    </div>
  )
}
