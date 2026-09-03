import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* -------------------------------------------------------------------------- */
/* Countdown                                                                  */
/* -------------------------------------------------------------------------- */

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
  done: boolean
}

function split(totalMs: number): CountdownParts {
  const clamped = Math.max(0, totalMs)
  const s = Math.floor(clamped / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs: clamped,
    done: clamped <= 0,
  }
}

/** Second-accurate countdown that re-aligns to the wall clock every tick. */
export function useCountdown(target: Date): CountdownParts {
  const targetMs = target.getTime()
  const [parts, setParts] = useState(() => split(targetMs - Date.now()))

  useEffect(() => {
    let timer: number
    const tick = () => {
      const remaining = targetMs - Date.now()
      setParts(split(remaining))
      // Re-sync to the next whole second so digits flip on the beat.
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timer)
  }, [targetMs])

  return parts
}

/* -------------------------------------------------------------------------- */
/* Typewriter                                                                 */
/* -------------------------------------------------------------------------- */

interface TypewriterOptions {
  /** Characters per second. */
  cps?: number
  enabled?: boolean
  startDelayMs?: number
  onDone?: () => void
  onTick?: (index: number) => void
}

/**
 * Frame-driven typewriter. Uses a rAF loop rather than an interval per
 * character so long answers stay smooth and cheap.
 */
export function useTypewriter(text: string, options: TypewriterOptions = {}) {
  const { cps = 52, enabled = true, startDelayMs = 0, onDone, onTick } = options
  const [count, setCount] = useState(enabled ? 0 : text.length)
  const doneRef = useRef(false)
  const cbRef = useRef({ onDone, onTick })
  cbRef.current = { onDone, onTick }

  useEffect(() => {
    doneRef.current = false
    if (!enabled || !text) {
      setCount(text.length)
      doneRef.current = true
      cbRef.current.onDone?.()
      return
    }
    setCount(0)
    let raf = 0
    let start = 0
    let lastEmitted = -1

    const step = (t: number) => {
      if (!start) start = t
      const elapsed = t - start - startDelayMs
      if (elapsed < 0) {
        raf = requestAnimationFrame(step)
        return
      }
      const next = Math.min(text.length, Math.floor((elapsed / 1000) * cps))
      if (next !== lastEmitted) {
        lastEmitted = next
        setCount(next)
        cbRef.current.onTick?.(next)
      }
      if (next < text.length) {
        raf = requestAnimationFrame(step)
      } else if (!doneRef.current) {
        doneRef.current = true
        cbRef.current.onDone?.()
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, cps, enabled, startDelayMs])

  const skip = useCallback(() => {
    setCount(text.length)
    if (!doneRef.current) {
      doneRef.current = true
      cbRef.current.onDone?.()
    }
  }, [text.length])

  return useMemo(
    () => ({ shown: text.slice(0, count), done: count >= text.length, skip }),
    [text, count, skip],
  )
}

/* -------------------------------------------------------------------------- */
/* Holographic tilt                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Pointer-driven tilt + sheen for HUD cards. Writes straight to CSS custom
 * properties on the element (no React state) so hover costs nothing.
 */
export function useHoloTilt(maxTiltDeg = 6, enabled = true) {
  const ref = useRef<HTMLDivElement | null>(null)
  const frame = useRef(0)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width
      const py = (event.clientY - rect.top) / rect.height
      if (frame.current) return
      frame.current = requestAnimationFrame(() => {
        frame.current = 0
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
        el.style.setProperty('--rx', `${((0.5 - py) * maxTiltDeg * 2).toFixed(2)}deg`)
        el.style.setProperty('--ry', `${((px - 0.5) * maxTiltDeg * 2).toFixed(2)}deg`)
      })
    },
    [enabled, maxTiltDeg],
  )

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '50%')
  }, [])

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current) }, [])

  return { ref, onPointerMove, onPointerLeave }
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

/** Element size via ResizeObserver — used by the canvas layers. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, ...size }
}

/** Pauses expensive canvas work when the element scrolls out of view. */
export function useInViewport<T extends HTMLElement>(rootMargin = '120px') {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? true),
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return { ref, visible }
}

/** `true` once the document has been hidden/shown — used to pause rAF loops. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  )
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

/** Formats a Date as `HH:MM:SS` for the log terminal. */
export function clockStamp(date: Date): string {
  return date.toTimeString().slice(0, 8)
}
