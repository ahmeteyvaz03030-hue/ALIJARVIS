import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { seeded } from '../../lib/motion'
import { HoloCard } from '../hud/HoloCard'
import { HudButton } from '../hud/HudButton'
import {
  CONDITION_LABEL,
  currentWeather,
  forecast,
  type Condition,
} from '../../data/weather'

/* ------------------------------------------------------- condition visuals */

function SunFx() {
  const { calm } = useSystem()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -right-10 -top-10 h-44 w-44 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,181,77,0.30), rgba(255,181,77,0.08) 45%, transparent 70%)',
        }}
        animate={calm ? undefined : { opacity: [0.65, 1, 0.65], scale: [1, 1.07, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {!calm && (
        <motion.div
          className="absolute -right-10 -top-10 h-44 w-44"
          animate={{ rotate: 360 }}
          transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-24 w-px origin-top"
              style={{
                transform: `rotate(${i * 30}deg)`,
                background:
                  'linear-gradient(to bottom, rgba(255,181,77,0.28), transparent)',
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function RainFx() {
  const { calm, perfTier } = useSystem()
  const drops = useMemo(() => {
    const rand = seeded(3311)
    return Array.from({ length: perfTier === 'low' ? 16 : 30 }, () => ({
      left: rand() * 100,
      delay: rand() * 1.4,
      dur: 0.7 + rand() * 0.55,
      len: 12 + rand() * 22,
      opacity: 0.2 + rand() * 0.45,
    }))
  }, [perfTier])

  if (calm) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d, i) => (
        <motion.span
          key={i}
          className="absolute w-px"
          style={{
            left: `${d.left}%`,
            height: d.len,
            background: `linear-gradient(to bottom, transparent, rgba(53,230,255,${d.opacity}))`,
          }}
          initial={{ y: -40 }}
          animate={{ y: '130%' }}
          transition={{ duration: d.dur, repeat: Infinity, delay: d.delay, ease: 'linear' }}
        />
      ))}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-8"
        style={{
          background: 'linear-gradient(to top, rgba(53,230,255,0.10), transparent)',
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function CloudFx() {
  const { calm } = useSystem()
  if (calm) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {[
        { top: '8%', size: 150, dur: 46, delay: 0, o: 0.1 },
        { top: '38%', size: 210, dur: 62, delay: -18, o: 0.07 },
        { top: '62%', size: 120, dur: 38, delay: -9, o: 0.09 },
      ].map((c, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            top: c.top,
            width: c.size,
            height: c.size * 0.42,
            background: `radial-gradient(ellipse, rgba(182,244,255,${c.o}), transparent 70%)`,
            filter: 'blur(6px)',
          }}
          initial={{ x: '-40%' }}
          animate={{ x: '260%' }}
          transition={{ duration: c.dur, repeat: Infinity, delay: c.delay, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

function StormFx() {
  const { calm } = useSystem()
  return (
    <>
      <RainFx />
      {!calm && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-ice"
          animate={{ opacity: [0, 0, 0.16, 0, 0.09, 0, 0] }}
          transition={{ duration: 7, repeat: Infinity, times: [0, 0.62, 0.64, 0.67, 0.69, 0.72, 1] }}
        />
      )}
    </>
  )
}

function NightFx() {
  const { calm } = useSystem()
  const stars = useMemo(() => {
    const rand = seeded(6003)
    return Array.from({ length: 26 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      d: rand() * 3,
      s: rand() > 0.85 ? 2 : 1,
    }))
  }, [])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-ice"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s }}
          animate={calm ? { opacity: 0.4 } : { opacity: [0.15, 0.7, 0.15] }}
          transition={{ duration: 3 + s.d, repeat: Infinity, delay: s.d, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

const FX: Record<Condition, () => React.ReactElement | null> = {
  sun: SunFx,
  clouds: CloudFx,
  rain: RainFx,
  storm: StormFx,
  night: NightFx,
}

/* ------------------------------------------------------------ glyphs */

function ConditionGlyph({ condition, size = 34 }: { condition: Condition; size?: number }) {
  const { calm } = useSystem()
  const stroke = condition === 'sun' ? '#ffb54d' : condition === 'night' ? '#b6f4ff' : '#35e6ff'
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
  }

  if (condition === 'sun') {
    return (
      <motion.svg
        {...common}
        animate={calm ? undefined : { rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="16" cy="16" r="6" />
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1="16"
            y1="4"
            x2="16"
            y2="7.5"
            transform={`rotate(${i * 45} 16 16)`}
          />
        ))}
      </motion.svg>
    )
  }
  if (condition === 'night') {
    return (
      <svg {...common}>
        <path d="M20 5a11 11 0 1 0 7 20A12 12 0 0 1 20 5z" />
        <circle cx="9" cy="8" r="0.9" fill={stroke} />
        <circle cx="6" cy="14" r="0.7" fill={stroke} />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M9 21h13a4 4 0 0 0 0-8 6.2 6.2 0 0 0-11.7-1.6A4.7 4.7 0 0 0 9 21z" />
      {(condition === 'rain' || condition === 'storm') &&
        [11, 16, 21].map((x) => <line key={x} x1={x} y1="24" x2={x - 1.5} y2="29" />)}
      {condition === 'storm' && (
        <path d="M17 22.5l-2.5 4h3l-2 4" strokeWidth="1.2" stroke="#ffb54d" />
      )}
    </svg>
  )
}

/* ------------------------------------------------------------- the module */

const CYCLE: Condition[] = ['sun', 'clouds', 'rain', 'storm', 'night']

export function WeatherPanel({ index = 0 }: { index?: number }) {
  const { pushLog } = useSystem()
  const [override, setOverride] = useState<Condition | null>(null)
  const [now, setNow] = useState(() => currentWeather(undefined))
  const days = useMemo(() => forecast(), [])

  useEffect(() => {
    setNow(currentWeather(override ?? undefined))
    const timer = window.setInterval(() => setNow(currentWeather(override ?? undefined)), 60_000)
    return () => window.clearInterval(timer)
  }, [override])

  const Fx = FX[now.condition]

  return (
    <HoloCard
      title="Weather · Marmaris"
      status={CONDITION_LABEL[now.condition]}
      index={index}
      tone={now.condition === 'sun' ? 'amber' : 'cyan'}
      bodyClassName="p-0"
      actions={
        <HudButton
          small
          variant="ghost"
          onClick={() => {
            const next = CYCLE[(CYCLE.indexOf(now.condition) + 1) % CYCLE.length]
            setOverride(next)
            pushLog(`Weather simulation → ${CONDITION_LABEL[next]}`, 'info')
          }}
        >
          SIM
        </HudButton>
      }
    >
      <div className="relative overflow-hidden">
        <Fx />

        <div className="relative p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-black leading-none tabular-nums text-ice text-glow">
                  {now.tempC}
                </span>
                <span className="mb-1 font-display text-lg text-cyan/70">°C</span>
              </div>
              <div className="mt-1 font-mono text-[0.6rem] tracking-[0.16em] text-cyan/55">
                GEFÜHLT {now.feelsC}°C · MEER {now.seaC}°C
              </div>
            </div>
            <ConditionGlyph condition={now.condition} size={44} />
          </div>

          <p className="mt-3 max-w-sm text-[0.78rem] leading-relaxed text-ice/70">
            {now.summary}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 border-y border-cyan/10 py-2.5">
            {[
              ['WIND', `${now.windKmh} km/h`],
              ['FEUCHTE', `${now.humidity}%`],
              ['UV', String(now.uv)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="hud-label mb-0.5">{k}</div>
                <div className="font-display text-[0.74rem] font-bold text-cyan">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between gap-1">
            {days.map((d, i) => (
              <motion.div
                key={d.day}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4 }}
                className="flex flex-1 flex-col items-center gap-1 border border-cyan/10 bg-cyan/[0.03] py-2"
              >
                <span className="font-display text-[0.5rem] font-bold tracking-[0.12em] text-cyan/60">
                  {d.day}
                </span>
                <ConditionGlyph condition={d.condition} size={20} />
                <span className="font-mono text-[0.58rem] tabular-nums text-ice/85">{d.hi}°</span>
                <span className="font-mono text-[0.52rem] tabular-nums text-cyan/40">{d.lo}°</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </HoloCard>
  )
}
