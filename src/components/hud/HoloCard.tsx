import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { useHoloTilt } from '../../lib/hooks'
import { calmPanelVariants, panelVariants } from '../../lib/motion'
import { ScanLine } from '../fx/ScanLine'

type Tone = 'cyan' | 'lime' | 'amber' | 'violet' | 'danger'

const TONE_RGB: Record<Tone, string> = {
  cyan: '53,230,255',
  lime: '124,255,155',
  amber: '255,181,77',
  violet: '169,123,255',
  danger: '255,90,110',
}

export interface HoloCardProps {
  title?: string
  /** Right-aligned status chip in the header. */
  status?: string
  tone?: Tone
  /** Stagger index for the entry animation. */
  index?: number
  children?: ReactNode
  className?: string
  bodyClassName?: string
  /** Adds the slow scan pass. Off by default so it stays special. */
  scan?: boolean
  /** Disables the tilt (use inside scroll containers or dense grids). */
  flat?: boolean
  actions?: ReactNode
  onClick?: () => void
}

/**
 * The workhorse HUD panel: rails in on mount, tilts under the pointer, lights
 * a holographic sheen that tracks the cursor, and keeps an animated hairline
 * running along its top edge.
 */
export function HoloCard({
  title,
  status,
  tone = 'cyan',
  index = 0,
  children,
  className = '',
  bodyClassName = '',
  scan = false,
  flat = false,
  actions,
  onClick,
}: HoloCardProps) {
  const { calm, cue, fx } = useSystem()
  const tilt = useHoloTilt(flat || calm ? 0 : 5, !flat && !calm)
  const rgb = TONE_RGB[tone]

  return (
    <motion.div
      variants={calm ? calmPanelVariants : panelVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      className={`group/holo relative ${className}`}
      style={{ perspective: 1100 }}
      onClick={onClick}
    >
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        onPointerEnter={() => cue('panel')}
        className="panel panel-cut relative h-full"
        style={
          {
            '--tone': rgb,
            borderColor: `rgba(${rgb},0.24)`,
            transform: calm || flat
              ? undefined
              : 'rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))',
            transformStyle: 'preserve-3d',
            transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1), box-shadow 300ms ease',
            willChange: flat ? undefined : 'transform',
          } as React.CSSProperties
        }
      >
        {/* pointer-tracking sheen */}
        <div
          className="holo-sheen"
          style={{
            background: `radial-gradient(340px circle at var(--mx,50%) var(--my,50%), rgba(${rgb},0.15), transparent 62%)`,
          }}
        />
        {/* animated top hairline */}
        {fx.cardShimmer && <div className="edge-shimmer" />}
        {/* corner brackets */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-3.5 h-4 w-px opacity-70"
          style={{ background: `rgba(${rgb},0.8)` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 right-0 h-4 w-px opacity-70"
          style={{ background: `rgba(${rgb},0.8)` }}
        />

        {scan && fx.scanPasses && <ScanLine tone={tone === 'violet' || tone === 'danger' ? 'cyan' : tone} />}

        {(title || status || actions) && (
          <header
            className="relative flex items-center justify-between gap-3 border-b px-4 py-2.5"
            style={{
              borderColor: `rgba(${rgb},0.16)`,
              background: `linear-gradient(90deg, rgba(${rgb},0.09), transparent 65%)`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rotate-45"
                style={{ background: `rgb(${rgb})`, boxShadow: `0 0 8px rgba(${rgb},0.9)` }}
              />
              {title && (
                <h2 className="hud-label truncate" style={{ color: `rgba(${rgb},0.8)` }}>
                  {title}
                </h2>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {status && (
                <span
                  className="font-mono text-[0.6rem] tracking-[0.2em]"
                  style={{ color: `rgba(${rgb},0.9)` }}
                >
                  {status}
                </span>
              )}
            </div>
          </header>
        )}

        <div className={`relative ${bodyClassName || 'p-4'}`}>{children}</div>
      </div>
    </motion.div>
  )
}
