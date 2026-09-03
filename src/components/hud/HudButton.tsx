import { motion, type HTMLMotionProps } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { useSystem } from '../../state/SystemProvider'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'

export interface HudButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: Variant
  busy?: boolean
  /** Renders a compact version for toolbars. */
  small?: boolean
  icon?: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  primary: 'hud-btn-primary',
  ghost: 'hud-btn-ghost',
  danger: 'hud-btn-danger',
}

/**
 * HUD button with three distinct interaction states:
 *   hover  → border ignites, a light bar wipes across
 *   press  → quick inward pulse plus an expanding energy ring
 *   busy   → a scanner sweeps the face and the label dims
 */
export function HudButton({
  children,
  variant = 'default',
  busy = false,
  small = false,
  icon,
  className = '',
  disabled,
  onClick,
  ...rest
}: HudButtonProps) {
  const { calm, cue } = useSystem()
  const ringRef = useRef<HTMLSpanElement | null>(null)

  const spawnRing = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (calm) return
    const host = ringRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const ring = document.createElement('span')
    ring.style.cssText = `position:absolute;left:${event.clientX - rect.left}px;top:${
      event.clientY - rect.top
    }px;width:12px;height:12px;margin:-6px 0 0 -6px;border:1px solid rgba(182,244,255,0.9);border-radius:50%;pointer-events:none;animation:jv-pulse-ring 620ms cubic-bezier(0.16,1,0.3,1) forwards;`
    host.appendChild(ring)
    window.setTimeout(() => ring.remove(), 640)
  }

  return (
    <motion.button
      type="button"
      className={`hud-btn ${VARIANT_CLASS[variant]} ${
        small ? 'px-3 py-1.5 text-[0.58rem] tracking-[0.18em]' : ''
      } ${className}`}
      disabled={disabled || busy}
      whileHover={calm || disabled || busy ? undefined : { y: -1 }}
      whileTap={calm || disabled || busy ? undefined : { scale: 0.965, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      onClick={(event) => {
        spawnRing(event)
        cue(busy ? 'process' : 'nav')
        onClick?.(event)
      }}
      {...rest}
    >
      <span ref={ringRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {busy && <span className="btn-scanner" aria-hidden="true" />}
      {icon && <span className="relative -mt-px opacity-90">{icon}</span>}
      <span className={`relative transition-opacity ${busy ? 'opacity-55' : ''}`}>
        {children}
      </span>
    </motion.button>
  )
}
