import { useMemo, useState } from 'react'
import type { Movie, PosterArt as ArtKind } from '../../data/movies'
import { seeded } from '../../lib/motion'

/**
 * Procedural poster artwork — no image assets, so the entertainment module
 * loads instantly and works offline. Each film gets a distinct composition
 * driven by its palette.
 */
export function PosterArt({
  art,
  palette,
  seed = 1,
  className = '',
}: {
  art: ArtKind
  palette: [string, string]
  seed?: number
  className?: string
}) {
  const [c1, c2] = palette
  const grain = useMemo(() => {
    const rand = seeded(seed * 977 + 13)
    return Array.from({ length: 40 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: rand() * 0.9 + 0.15,
      o: rand() * 0.25,
    }))
  }, [seed])

  return (
    <svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.85" />
          <stop offset="55%" stopColor={c2} />
          <stop offset="100%" stopColor="#04080d" />
        </linearGradient>
        <radialGradient id={`glow-${seed}`} cx="50%" cy="38%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.75" />
          <stop offset="100%" stopColor={c1} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`scrim-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#04080d" stopOpacity="0" />
          <stop offset="55%" stopColor="#04080d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#04080d" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect width="100" height="150" fill={`url(#bg-${seed})`} />

      {art === 'sun' && (
        <>
          <circle cx="50" cy="58" r="30" fill={`url(#glow-${seed})`} />
          <circle cx="50" cy="58" r="19" fill="none" stroke={c1} strokeOpacity="0.85" strokeWidth="0.8" />
          <circle cx="50" cy="58" r="26" fill="none" stroke={c1} strokeOpacity="0.35" strokeWidth="0.5" />
          {Array.from({ length: 22 }, (_, i) => (
            <rect
              key={i}
              x="0"
              y={92 + i * 2.6}
              width="100"
              height={0.5 + i * 0.06}
              fill={c1}
              opacity={0.05 + i * 0.012}
            />
          ))}
        </>
      )}

      {art === 'rings' && (
        <>
          <circle cx="50" cy="66" r="34" fill={`url(#glow-${seed})`} opacity="0.7" />
          {[10, 18, 26, 34, 42].map((r, i) => (
            <ellipse
              key={r}
              cx="50"
              cy="66"
              rx={r}
              ry={r * 0.34}
              fill="none"
              stroke={c1}
              strokeOpacity={0.7 - i * 0.11}
              strokeWidth="0.7"
            />
          ))}
          <circle cx="50" cy="66" r="7" fill="#04080d" />
          <circle cx="50" cy="66" r="7" fill="none" stroke={c1} strokeWidth="0.8" />
        </>
      )}

      {art === 'grid' && (
        <>
          <g stroke={c1} strokeOpacity="0.28" strokeWidth="0.35">
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`v${i}`} x1={i * 10} y1="60" x2={50 + (i * 10 - 50) * 2.6} y2="150" />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={60 + i * i * 1.35} x2="100" y2={60 + i * i * 1.35} />
            ))}
          </g>
          <rect x="34" y="24" width="32" height="32" fill="none" stroke={c1} strokeOpacity="0.8" strokeWidth="0.8" transform="rotate(45 50 40)" />
        </>
      )}

      {art === 'wave' && (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <path
              key={i}
              d={`M0 ${52 + i * 6} Q 25 ${40 + i * 6} 50 ${52 + i * 6} T 100 ${52 + i * 6}`}
              fill="none"
              stroke={c1}
              strokeOpacity={0.5 - i * 0.026}
              strokeWidth="0.6"
            />
          ))}
          <circle cx="50" cy="34" r="12" fill="none" stroke={c1} strokeOpacity="0.9" strokeWidth="0.9" />
        </>
      )}

      {art === 'monolith' && (
        <>
          <rect x="42" y="26" width="16" height="72" fill="#04080d" opacity="0.85" />
          <rect x="42" y="26" width="16" height="72" fill="none" stroke={c1} strokeOpacity="0.75" strokeWidth="0.7" />
          <circle cx="50" cy="26" r="22" fill={`url(#glow-${seed})`} opacity="0.55" />
          <g stroke={c1} strokeOpacity="0.2" strokeWidth="0.35">
            {Array.from({ length: 7 }, (_, i) => (
              <line key={i} x1="0" y1={104 + i * 6} x2="100" y2={104 + i * 6} />
            ))}
          </g>
        </>
      )}

      {/* film grain */}
      <g fill="#ffffff">
        {grain.map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y} r={g.r} opacity={g.o} />
        ))}
      </g>

      {/* bottom scrim so the title stays readable */}
      <rect x="0" y="78" width="100" height="72" fill={`url(#scrim-${seed})`} />
    </svg>
  )
}


/** Real TMDB poster when available; falls back to the procedural art above if
 *  there's no image, or if it fails to load (dead link, offline, blocked). */
export function PosterImage({
  movie,
  index = 0,
  className = '',
}: {
  movie: Movie
  index?: number
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (movie.posterUrl && !broken) {
    return (
      <img
        src={movie.posterUrl}
        alt={movie.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`${className} object-cover`}
      />
    )
  }
  return (
    <PosterArt art={movie.art} palette={movie.palette} seed={movie.title.length + index} className={className} />
  )
}
