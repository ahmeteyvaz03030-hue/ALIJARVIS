import type { Transition, Variants } from 'framer-motion'

/** Shared easing curves — calm, weighted, never bouncy-for-the-sake-of-it. */
export const EASE = {
  /** Standard HUD ease-out. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Mechanical, for panels sliding on rails. */
  rail: [0.65, 0, 0.35, 1] as const,
  /** Fast attack, long settle — good for readouts snapping in. */
  snap: [0.05, 0.7, 0.1, 1] as const,
  inOut: [0.45, 0, 0.55, 1] as const,
}

export const SPRING = {
  soft: { type: 'spring', stiffness: 140, damping: 22, mass: 0.9 } satisfies Transition,
  crisp: { type: 'spring', stiffness: 320, damping: 26, mass: 0.7 } satisfies Transition,
  hud: { type: 'spring', stiffness: 210, damping: 24, mass: 0.8 } satisfies Transition,
}

/**
 * Panels arrive on rails: they slide in from the edge of the HUD, brighten,
 * then settle. `custom` is the stagger index.
 */
export const panelVariants: Variants = {
  hidden: (i: number = 0) => ({
    opacity: 0,
    y: 26,
    scale: 0.965,
    transition: { delay: i * 0.02 },
  }),
  // No `filter` in here on purpose: framer-motion leaves the final value as an
  // inline style, so every card would keep a `filter: brightness(1)` forever,
  // and any element with a filter takes a slower paint path from then on.
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.62,
      ease: EASE.out,
      delay: 0.05 + i * 0.085,
    },
  }),
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.99,
    transition: { duration: 0.24, ease: EASE.rail },
  },
}

/** View-level transition: old modules power down, new ones rail in. */
export const viewVariants: Variants = {
  // Blurring the whole view during a switch meant a full-page filter pass on
  // every frame of the transition — the single jankiest moment in the app.
  hidden: { opacity: 0, x: 34 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE.out },
  },
  exit: {
    opacity: 0,
    x: -26,
    transition: { duration: 0.24, ease: EASE.rail },
  },
}

export const calmViewVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

export const calmPanelVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

/** Line-by-line terminal reveal. */
export const lineVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: EASE.snap },
  },
}

export function stagger(children: number, gap = 0.07): Transition {
  return { staggerChildren: gap, delayChildren: 0.05, when: 'beforeChildren', ...(children ? {} : {}) }
}

/** Deterministic pseudo-random so particle layouts don't flicker on re-render. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 0xffffffff
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
