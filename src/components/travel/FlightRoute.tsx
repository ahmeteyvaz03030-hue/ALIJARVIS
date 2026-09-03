import { motion, useAnimationFrame } from 'framer-motion'
import { useMemo, useRef } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { ARRIVAL_AIRPORT, DESTINATION, ORIGIN, TRIP, type Waypoint } from '../../lib/config'
import { seeded } from '../../lib/motion'

/* ---------------------------------------------------------------- geometry */

const VIEW_W = 400
const VIEW_H = 230
const BOUNDS = { lonMin: 4, lonMax: 33, latMin: 32.5, latMax: 53.5 }

function project(lon: number, lat: number) {
  const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * (VIEW_W - 40) + 20
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * (VIEW_H - 44) + 22
  return { x, y }
}

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Great-circle interpolation (slerp on the unit sphere). */
function greatCircle(a: Waypoint, b: { lat: number; lon: number }, steps = 48) {
  const φ1 = toRad(a.lat)
  const λ1 = toRad(a.lon)
  const φ2 = toRad(b.lat)
  const λ2 = toRad(b.lon)
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    )
  if (d === 0) return [project(a.lon, a.lat)]
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    return project(toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y))))
  })
}

/** Waypoints along the corridor — they make the tactical map read as real. */
const CORRIDOR = [
  { name: 'MUC', lon: 11.786, lat: 48.353 },
  { name: 'VIE', lon: 16.57, lat: 48.12 },
  { name: 'BEG', lon: 20.31, lat: 44.82 },
  { name: 'SKP', lon: 21.62, lat: 41.96 },
  { name: 'ATH', lon: 23.95, lat: 37.94 },
  { name: 'IST', lon: 28.81, lat: 40.98 },
]

/* ------------------------------------------------------------------ module */

export function FlightRoute({ progress }: { progress: number }) {
  const { calm, perfTier, phase } = useSystem()
  const pathRef = useRef<SVGPathElement | null>(null)
  const planeRef = useRef<SVGGElement | null>(null)
  const trailRef = useRef<SVGCircleElement | null>(null)
  const loopStart = useRef(performance.now())

  const points = useMemo(() => greatCircle(ORIGIN, ARRIVAL_AIRPORT, 56), [])
  const routeD = useMemo(
    () => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
    [points],
  )

  const noise = useMemo(() => {
    const rand = seeded(881)
    const density = perfTier === 'low' ? 140 : 320
    return Array.from({ length: density }, () => ({
      x: rand() * VIEW_W,
      y: 18 + rand() * (VIEW_H - 36),
      o: 0.05 + rand() * 0.16,
      r: rand() > 0.9 ? 0.9 : 0.55,
    }))
  }, [perfTier])

  /**
   * Plane placement. During the actual flight it tracks the real progress;
   * before departure it flies the route on a loop as a live simulation.
   */
  useAnimationFrame((t) => {
    const path = pathRef.current
    const plane = planeRef.current
    if (!path || !plane) return
    const total = path.getTotalLength()
    let f: number
    if (phase === 'in_flight') {
      f = Math.min(1, Math.max(0, progress))
    } else if (phase === 'arrived' || phase === 'returned') {
      f = 1
    } else if (calm) {
      f = 0.001
    } else {
      const cycle = 9000
      const elapsed = (t - loopStart.current) % cycle
      f = Math.min(1, elapsed / (cycle * 0.86))
    }
    const at = path.getPointAtLength(total * f)
    const ahead = path.getPointAtLength(Math.min(total, total * f + 1.5))
    const angle = toDeg(Math.atan2(ahead.y - at.y, ahead.x - at.x))
    plane.setAttribute('transform', `translate(${at.x} ${at.y}) rotate(${angle})`)
    if (trailRef.current) {
      trailRef.current.setAttribute('cx', String(at.x))
      trailRef.current.setAttribute('cy', String(at.y))
    }
  })

  const originPt = project(ORIGIN.lon, ORIGIN.lat)
  const destPt = project(DESTINATION.lon, DESTINATION.lat)
  const airportPt = project(ARRIVAL_AIRPORT.lon, ARRIVAL_AIRPORT.lat)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full">
        <defs>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#35e6ff" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#b6f4ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#7cff9b" stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="sea-glow" cx="55%" cy="70%">
            <stop offset="0%" stopColor="#0c2e3d" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#04080d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#sea-glow)" />

        {/* terrain dot matrix */}
        <g>
          {noise.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="#35e6ff" fillOpacity={n.o} />
          ))}
        </g>

        {/* graticule */}
        <g stroke="#35e6ff" strokeWidth="0.4">
          {[35, 40, 45, 50].map((lat) => {
            const y = project(BOUNDS.lonMin, lat).y
            return (
              <g key={lat}>
                <line x1="16" y1={y} x2={VIEW_W - 16} y2={y} strokeOpacity="0.1" />
                <text
                  x="8"
                  y={y + 2}
                  fill="#35e6ff"
                  fillOpacity="0.3"
                  fontSize="4.4"
                  fontFamily="Share Tech Mono, monospace"
                >
                  {lat}
                </text>
              </g>
            )
          })}
          {[10, 15, 20, 25, 30].map((lon) => {
            const x = project(lon, BOUNDS.latMax).x
            return (
              <g key={lon}>
                <line x1={x} y1="18" x2={x} y2={VIEW_H - 18} strokeOpacity="0.1" />
                <text
                  x={x}
                  y="14"
                  fill="#35e6ff"
                  fillOpacity="0.3"
                  fontSize="4.4"
                  textAnchor="middle"
                  fontFamily="Share Tech Mono, monospace"
                >
                  {lon}E
                </text>
              </g>
            )
          })}
        </g>

        {/* corridor reference points */}
        <g>
          {CORRIDOR.map((c) => {
            const p = project(c.lon, c.lat)
            return (
              <g key={c.name}>
                <circle cx={p.x} cy={p.y} r="1.3" fill="#35e6ff" fillOpacity="0.45" />
                <text
                  x={p.x + 3.5}
                  y={p.y + 1.6}
                  fill="#35e6ff"
                  fillOpacity="0.4"
                  fontSize="4.2"
                  fontFamily="Share Tech Mono, monospace"
                >
                  {c.name}
                </text>
              </g>
            )
          })}
        </g>

        {/* route: base, flowing dash, drawn-in overlay */}
        <path ref={pathRef} d={routeD} fill="none" stroke="#35e6ff" strokeOpacity="0.18" strokeWidth="1.6" />
        <motion.path
          d={routeD}
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: calm ? 0.3 : 2.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: 'drop-shadow(0 0 4px rgba(53,230,255,0.55))' }}
        />
        {!calm && (
          <path
            d={routeD}
            fill="none"
            stroke="#eafcff"
            strokeOpacity="0.9"
            strokeWidth="1.1"
            strokeDasharray="5 995"
            style={{ animation: 'jv-dash 6s linear infinite' }}
          />
        )}

        {/* endpoints */}
        {[
          { p: originPt, label: ORIGIN.code, sub: ORIGIN.country, tone: '#35e6ff' },
          { p: airportPt, label: ARRIVAL_AIRPORT.code, sub: ARRIVAL_AIRPORT.name, tone: '#7cff9b' },
        ].map((node) => (
          <g key={node.label}>
            {!calm && (
              <motion.circle
                cx={node.p.x}
                cy={node.p.y}
                r="4"
                fill="none"
                stroke={node.tone}
                strokeWidth="0.8"
                initial={{ r: 3, opacity: 0.85 }}
                animate={{ r: [3, 11], opacity: [0.85, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <circle cx={node.p.x} cy={node.p.y} r="2.6" fill={node.tone} />
            <circle cx={node.p.x} cy={node.p.y} r="5.4" fill="none" stroke={node.tone} strokeOpacity="0.5" strokeWidth="0.7" />
            <text
              x={node.p.x}
              y={node.p.y - 8.5}
              fill={node.tone}
              fontSize="6.4"
              textAnchor="middle"
              fontFamily="Orbitron, sans-serif"
              fontWeight="700"
            >
              {node.label}
            </text>
            <text
              x={node.p.x}
              y={node.p.y + 12}
              fill={node.tone}
              fillOpacity="0.6"
              fontSize="4.4"
              textAnchor="middle"
              fontFamily="Share Tech Mono, monospace"
            >
              {node.sub}
            </text>
          </g>
        ))}

        {/* Marmaris itself, south-west of the airport */}
        <g>
          <circle cx={destPt.x} cy={destPt.y} r="1.8" fill="#ffb54d" />
          <line
            x1={airportPt.x}
            y1={airportPt.y}
            x2={destPt.x}
            y2={destPt.y}
            stroke="#ffb54d"
            strokeOpacity="0.45"
            strokeWidth="0.7"
            strokeDasharray="2 2"
          />
          <text
            x={destPt.x - 3}
            y={destPt.y + 7}
            fill="#ffb54d"
            fillOpacity="0.85"
            fontSize="5"
            textAnchor="end"
            fontFamily="Orbitron, sans-serif"
            fontWeight="700"
          >
            MARMARIS
          </text>
        </g>

        {/* moving aircraft */}
        <circle ref={trailRef} r="7" fill="#eafcff" fillOpacity="0.1" />
        <g ref={planeRef}>
          <g transform="rotate(90)">
            <path
              d="M0,-6 L1.9,-1.4 L6.6,1.2 L6.6,2.4 L1.9,1.6 L1.3,5.2 L3.2,6.4 L3.2,7.2 L0,6.4 L-3.2,7.2 L-3.2,6.4 L-1.3,5.2 L-1.9,1.6 L-6.6,2.4 L-6.6,1.2 L-1.9,-1.4 Z"
              fill="#eafcff"
              style={{ filter: 'drop-shadow(0 0 5px #35e6ff)' }}
            />
          </g>
        </g>

        {/* frame ticks */}
        <g stroke="#35e6ff" strokeOpacity="0.5" strokeWidth="0.9">
          <path d="M4 16 L4 4 L16 4" fill="none" />
          <path d={`M${VIEW_W - 16} 4 L${VIEW_W - 4} 4 L${VIEW_W - 4} 16`} fill="none" />
          <path d={`M4 ${VIEW_H - 16} L4 ${VIEW_H - 4} L16 ${VIEW_H - 4}`} fill="none" />
          <path
            d={`M${VIEW_W - 16} ${VIEW_H - 4} L${VIEW_W - 4} ${VIEW_H - 4} L${VIEW_W - 4} ${VIEW_H - 16}`}
            fill="none"
          />
        </g>
      </svg>

      {/* readouts */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: 'ROUTE', v: 'CALCULATED', tone: 'text-lime' },
          { k: 'DISTANCE', v: `${TRIP.distanceKm} KM`, tone: 'text-ice' },
          { k: 'FLIGHT PATH', v: 'ACTIVE', tone: 'text-lime' },
          { k: 'FLIGHT NO.', v: TRIP.flightNumber, tone: 'text-ice' },
        ].map((cell, i) => (
          <motion.div
            key={cell.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.09, duration: 0.45 }}
            className="border border-cyan/12 bg-cyan/[0.03] px-2.5 py-1.5"
          >
            <div className="hud-label mb-0.5">{cell.k}</div>
            <div className={`font-display text-[0.72rem] font-bold tracking-[0.1em] ${cell.tone}`}>
              {cell.v}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
