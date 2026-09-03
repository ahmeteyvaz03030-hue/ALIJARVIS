import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSystem } from '../../state/SystemProvider'
import { HoloCard } from '../hud/HoloCard'
import { AnimatedNumber, SegmentBar, StatusPill } from '../hud/Readout'

/** Rolling history sparkline — SVG polyline, one path update per tick. */
function Sparkline({ data, tone = '53,230,255' }: { data: number[]; tone?: string }) {
  const width = 100
  const height = 26
  if (data.length < 2) return <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-full" />
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = Math.max(1, max - min)
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / span) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-6 w-full">
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={`rgba(${tone},0.12)`}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={`rgb(${tone})`}
        strokeWidth="1.2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 3px rgba(${tone},0.7))` }}
      />
    </svg>
  )
}

/**
 * SYSTEM MONITOR — simulated but continuously moving telemetry, so the OS
 * always feels alive. Values drift toward a baseline rather than jumping.
 */
export function SystemMonitor({ index = 0 }: { index?: number }) {
  const { stats, calm } = useSystem()
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [netHistory, setNetHistory] = useState<number[]>([])
  const last = useRef(0)

  useEffect(() => {
    // Sample on stats changes, capped at ~24 points.
    const now = Date.now()
    if (now - last.current < 900) return
    last.current = now
    setCpuHistory((h) => [...h, stats.cpu].slice(-24))
    setNetHistory((h) => [...h, stats.network].slice(-24))
  }, [stats.cpu, stats.network])

  const rows: Array<{
    label: string
    value: string
    bar?: number
    tone: 'cyan' | 'lime' | 'amber'
  }> = [
    { label: 'Travel Database', value: stats.travelDb, tone: stats.travelDb === 'SYNCED' ? 'lime' : 'amber' },
    { label: 'Marmaris Data', value: stats.marmarisDb, tone: stats.marmarisDb === 'ONLINE' ? 'lime' : 'amber' },
    { label: 'Tony Connection', value: stats.tonyLink, tone: stats.tonyLink === 'ACTIVE' ? 'lime' : 'amber' },
  ]

  return (
    <HoloCard
      title="System Monitor"
      status="LIVE"
      index={index}
      tone="cyan"
      bodyClassName="p-4 space-y-4"
    >
      {/* headline gauges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-cyan/12 bg-cyan/[0.03] p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="hud-label">CPU</span>
            <span className="font-display text-lg font-black tabular-nums text-ice">
              <AnimatedNumber value={stats.cpu} suffix="%" />
            </span>
          </div>
          <Sparkline data={cpuHistory} />
          <SegmentBar value={stats.cpu} segments={12} tone={stats.cpu > 65 ? 'amber' : 'cyan'} />
        </div>
        <div className="border border-cyan/12 bg-cyan/[0.03] p-2.5">
          <div className="flex items-baseline justify-between">
            <span className="hud-label">Network</span>
            <span className="font-display text-lg font-black tabular-nums text-ice">
              <AnimatedNumber value={stats.network} suffix="%" />
            </span>
          </div>
          <Sparkline data={netHistory} tone="124,255,155" />
          <SegmentBar value={stats.network} segments={12} tone="lime" />
        </div>
      </div>

      {/* numeric strip */}
      <div className="grid grid-cols-3 gap-2 border-y border-cyan/10 py-2.5">
        {[
          { k: 'PING', v: stats.ping, s: 'ms' },
          { k: 'MEMORY', v: stats.memory, s: '%' },
          { k: 'UPLINK', v: stats.uplink, s: '%' },
        ].map((cell) => (
          <div key={cell.k} className="text-center">
            <div className="hud-label mb-0.5">{cell.k}</div>
            <div className="font-display text-sm font-bold tabular-nums text-cyan">
              <AnimatedNumber value={cell.v} suffix={cell.s} />
            </div>
          </div>
        ))}
      </div>

      {/* service list */}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            className="flex items-center justify-between gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
          >
            <span className="hud-label">{row.label}</span>
            <StatusPill tone={row.tone} pulse={!calm}>
              {row.value}
            </StatusPill>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-cyan/10 pt-2.5">
        <span className="hud-label">System Status</span>
        <motion.span
          className="font-display text-[0.68rem] font-black tracking-[0.24em] text-lime text-glow-lime"
          animate={calm ? undefined : { opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {stats.cpu > 70 ? 'ELEVATED LOAD' : 'OPTIMAL'}
        </motion.span>
      </div>
    </HoloCard>
  )
}
