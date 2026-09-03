import { useEffect, useRef } from 'react'
import { useSystem } from '../../state/SystemProvider'
import { usePageVisible } from '../../lib/hooks'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hot: boolean
}

/**
 * Ambient data-field behind the whole OS: drifting nodes, faint links between
 * neighbours, a slow pointer parallax. Deliberately low-contrast so panel text
 * stays perfectly readable.
 *
 * Budget: one canvas, one rAF loop, capped DPR, neighbour search limited to a
 * forward scan — comfortably inside frame budget on a mid phone.
 */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { calm, perfTier } = useSystem()
  const pageVisible = usePageVisible()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, perfTier === 'low' ? 1 : 1.5)
    const count = calm ? 34 : perfTier === 'low' ? 30 : 64
    const linkDist = perfTier === 'low' ? 108 : 138
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let raf = 0
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 }

    const seed = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.5 + 0.5,
        hot: Math.random() > 0.86,
      }))
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    const draw = (moving: boolean) => {
      ctx.clearRect(0, 0, width, height)

      // Links first so nodes sit on top.
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 > linkDist * linkDist) continue
          const alpha = (1 - Math.sqrt(d2) / linkDist) * 0.16
          ctx.strokeStyle = `rgba(53,230,255,${alpha.toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      for (const p of particles) {
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const near = dx * dx + dy * dy < 26_000
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + (near ? 0.9 : 0), 0, Math.PI * 2)
        ctx.fillStyle = p.hot
          ? `rgba(182,244,255,${near ? 0.95 : 0.62})`
          : `rgba(53,230,255,${near ? 0.7 : 0.34})`
        ctx.fill()
      }

      if (!moving) return
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20) p.x = width + 20
        if (p.x > width + 20) p.x = -20
        if (p.y < -20) p.y = height + 20
        if (p.y > height + 20) p.y = -20
      }
    }

    resize()
    window.addEventListener('resize', resize)

    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX
      pointer.ty = e.clientY
    }

    if (calm || !pageVisible) {
      draw(false)
    } else {
      window.addEventListener('pointermove', onPointer, { passive: true })
      const loop = () => {
        pointer.x += (pointer.tx - pointer.x) * 0.08
        pointer.y += (pointer.ty - pointer.y) * 0.08
        draw(true)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [calm, perfTier, pageVisible])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: calm ? 0.4 : 0.75 }}
    />
  )
}
