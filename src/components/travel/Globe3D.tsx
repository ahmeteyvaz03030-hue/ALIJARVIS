import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useSystem } from '../../state/SystemProvider'
import { ARRIVAL_AIRPORT, DESTINATION, ORIGIN } from '../../lib/config'
import { useInViewport } from '../../lib/hooks'

const R = 1
const DEG = Math.PI / 180

function toVec3(lat: number, lon: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

/** Great-circle arc lifted off the surface, so it reads as a flight path. */
function arcPoints(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  steps: number,
  lift = 0.16,
): THREE.Vector3[] {
  const from = toVec3(a.lat, a.lon).normalize()
  const to = toVec3(b.lat, b.lon).normalize()
  const angle = from.angleTo(to)
  const axis = new THREE.Vector3().crossVectors(from, to).normalize()
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps
    const v = from.clone().applyAxisAngle(axis, angle * f)
    return v.multiplyScalar(R + Math.sin(Math.PI * f) * lift)
  })
}

interface Label {
  id: string
  text: string
  sub: string
  place: 'above' | 'below'
  tone: string
}

/**
 * Hardware-accelerated globe: dot-matrix sphere, graticule, cyan atmosphere,
 * a glowing great-circle route from Germany to Türkiye and an aircraft flying
 * it. Mobile/low-tier devices get a lighter mesh and a lower pixel ratio;
 * reduce-motion renders a single static frame.
 */
export default function Globe3D({ height = 340 }: { height?: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const { calm, perfTier, pushLog } = useSystem()
  const viewport = useInViewport<HTMLDivElement>('200px')
  const [labels, setLabels] = useState<Label[]>([])
  const [screen, setScreen] = useState<Record<string, { x: number; y: number; visible: boolean }>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const low = perfTier === 'low'
    const width = mount.clientWidth || 320
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0, 3.15)
    camera.lookAt(0, 0, 0)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !low,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      pushLog('Globe renderer unavailable — falling back to 2D map', 'warn')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.75))
    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'pan-y'

    // Two nested groups: the outer one tilts the globe so mid-northern
    // latitudes face the camera, the inner one spins on the polar axis. Keeping
    // them separate means the spin never wobbles.
    const tilt = new THREE.Group()
    tilt.rotation.x = 0.58
    tilt.rotation.z = 0.1
    scene.add(tilt)
    const world = new THREE.Group()
    // Bring Europe/Anatolia to the front.
    world.rotation.y = -1.15
    tilt.add(world)

    const disposables: Array<{ dispose: () => void }> = []

    /* --- dark ocean sphere (occluder) ------------------------------------ */
    const shellGeo = new THREE.SphereGeometry(R * 0.995, low ? 32 : 48, low ? 24 : 36)
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x061420 })
    world.add(new THREE.Mesh(shellGeo, shellMat))
    disposables.push(shellGeo, shellMat)

    /* --- dot matrix ------------------------------------------------------ */
    const latStep = low ? 6 : 4
    const positions: number[] = []
    const colors: number[] = []
    const bright = new THREE.Color(0x9beefd)
    const dim = new THREE.Color(0x1f7f99)
    for (let lat = -84; lat <= 84; lat += latStep) {
      const circumference = Math.cos(lat * DEG)
      const count = Math.max(6, Math.round((360 / latStep) * circumference))
      for (let i = 0; i < count; i++) {
        const lon = -180 + (360 / count) * i
        const v = toVec3(lat, lon, R * 1.002)
        positions.push(v.x, v.y, v.z)
        // Highlight the corridor the flight crosses.
        const nearRoute =
          lon > 2 && lon < 34 && lat > 33 && lat < 55 ? 1 : 0
        const c = nearRoute ? bright : dim
        colors.push(c.r, c.g, c.b)
      }
    }
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const dotMat = new THREE.PointsMaterial({
      size: low ? 0.016 : 0.013,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    })
    world.add(new THREE.Points(dotGeo, dotMat))
    disposables.push(dotGeo, dotMat)

    /* --- graticule ------------------------------------------------------- */
    const gratPts: number[] = []
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let i = 0; i < 120; i++) {
        const a = toVec3(lat, -180 + i * 3, R * 1.004)
        const b = toVec3(lat, -180 + (i + 1) * 3, R * 1.004)
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let i = 0; i < 60; i++) {
        const a = toVec3(-90 + i * 3, lon, R * 1.004)
        const b = toVec3(-90 + (i + 1) * 3, lon, R * 1.004)
        gratPts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    const gratGeo = new THREE.BufferGeometry()
    gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(gratPts, 3))
    const gratMat = new THREE.LineBasicMaterial({
      color: 0x35e6ff,
      transparent: true,
      opacity: 0.11,
    })
    world.add(new THREE.LineSegments(gratGeo, gratMat))
    disposables.push(gratGeo, gratMat)

    /* --- atmosphere ------------------------------------------------------ */
    const atmoGeo = new THREE.SphereGeometry(R * 1.14, 40, 28)
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x35e6ff,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    world.add(new THREE.Mesh(atmoGeo, atmoMat))
    const rimGeo = new THREE.SphereGeometry(R * 1.03, 40, 28)
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x35e6ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    world.add(new THREE.Mesh(rimGeo, rimMat))
    disposables.push(atmoGeo, atmoMat, rimGeo, rimMat)

    /* --- route ----------------------------------------------------------- */
    const arc = arcPoints(ORIGIN, ARRIVAL_AIRPORT, 128, 0.17)
    const routeGeo = new THREE.BufferGeometry().setFromPoints(arc)
    const routeMat = new THREE.LineBasicMaterial({
      color: 0xb6f4ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    })
    world.add(new THREE.Line(routeGeo, routeMat))
    disposables.push(routeGeo, routeMat)

    // Ground shadow of the route, right on the surface.
    const groundGeo = new THREE.BufferGeometry().setFromPoints(
      arcPoints(ORIGIN, ARRIVAL_AIRPORT, 128, 0.004),
    )
    const groundMat = new THREE.LineBasicMaterial({
      color: 0x35e6ff,
      transparent: true,
      opacity: 0.32,
    })
    world.add(new THREE.Line(groundGeo, groundMat))
    disposables.push(groundGeo, groundMat)

    /* --- markers --------------------------------------------------------- */
    const markerDefs = [
      { id: 'de', lat: ORIGIN.lat, lon: ORIGIN.lon, color: 0x35e6ff, text: 'GERMANY', sub: ORIGIN.code },
      {
        id: 'tr',
        lat: DESTINATION.lat,
        lon: DESTINATION.lon,
        color: 0x7cff9b,
        text: 'MARMARIS / TÜRKİYE',
        sub: ARRIVAL_AIRPORT.code,
      },
    ]
    const pulseRings: THREE.Mesh[] = []
    for (const def of markerDefs) {
      const pos = toVec3(def.lat, def.lon, R * 1.01)
      const dotGeoM = new THREE.SphereGeometry(0.016, 10, 8)
      const dotMatM = new THREE.MeshBasicMaterial({ color: def.color })
      const dot = new THREE.Mesh(dotGeoM, dotMatM)
      dot.position.copy(pos)
      world.add(dot)
      disposables.push(dotGeoM, dotMatM)

      const ringGeo = new THREE.RingGeometry(0.03, 0.038, 28)
      const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(pos)
      ring.lookAt(pos.clone().multiplyScalar(2))
      world.add(ring)
      pulseRings.push(ring)
      disposables.push(ringGeo, ringMat)

      // A vertical stalk gives the marker presence on the sphere.
      const stalkGeo = new THREE.BufferGeometry().setFromPoints([
        pos,
        pos.clone().multiplyScalar(1.09),
      ])
      const stalkMat = new THREE.LineBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.55,
      })
      world.add(new THREE.Line(stalkGeo, stalkMat))
      disposables.push(stalkGeo, stalkMat)
    }

    setLabels(
      markerDefs.map((def) => ({
        id: def.id,
        text: def.text,
        sub: def.sub,
        // Germany's tag sits above its marker, Türkiye's below, so the two
        // never overlap even though the cities are only ~20° apart.
        place: def.id === 'de' ? ('above' as const) : ('below' as const),
        tone: def.id === 'de' ? '53,230,255' : '124,255,155',
      })),
    )

    /* --- aircraft -------------------------------------------------------- */
    const planeGeo = new THREE.ConeGeometry(0.022, 0.075, 4)
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xeafcff })
    const plane = new THREE.Mesh(planeGeo, planeMat)
    world.add(plane)
    disposables.push(planeGeo, planeMat)

    const trailGeo = new THREE.BufferGeometry().setFromPoints(arc.slice(0, 2))
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    })
    const trail = new THREE.Line(trailGeo, trailMat)
    world.add(trail)
    disposables.push(trailGeo, trailMat)

    /* --- interaction ----------------------------------------------------- */
    let dragging = false
    let lastX = 0
    let spin = calm ? 0 : 0.00042
    let velocity = 0
    const canDrag = !low

    const onDown = (e: PointerEvent) => {
      if (!canDrag) return
      dragging = true
      lastX = e.clientX
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      velocity = dx * 0.004
      world.rotation.y += velocity
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      try {
        renderer.domElement.releasePointerCapture(e.pointerId)
      } catch {
        /* pointer already released */
      }
    }
    if (canDrag) {
      renderer.domElement.addEventListener('pointerdown', onDown)
      renderer.domElement.addEventListener('pointermove', onMove)
      renderer.domElement.addEventListener('pointerup', onUp)
      renderer.domElement.addEventListener('pointercancel', onUp)
      renderer.domElement.style.cursor = 'grab'
    }

    /* --- projection of HTML labels --------------------------------------- */
    const projectLabels = () => {
      const next: Record<string, { x: number; y: number; visible: boolean }> = {}
      const camDir = camera.position.clone().normalize()
      for (const def of markerDefs) {
        const local = toVec3(def.lat, def.lon, R * 1.16)
        const worldPos = local.clone().applyMatrix4(world.matrixWorld)
        const normal = worldPos.clone().normalize()
        const facing = normal.dot(camDir) > 0.12
        const ndc = worldPos.clone().project(camera)
        next[def.id] = {
          x: (ndc.x * 0.5 + 0.5) * width,
          y: (-ndc.y * 0.5 + 0.5) * height,
          visible: facing,
        }
      }
      setScreen(next)
    }

    /* --- loop ------------------------------------------------------------ */
    let raf = 0
    let frame = 0
    const clock = new THREE.Clock()

    const renderFrame = (animate: boolean) => {
      const t = clock.getElapsedTime()
      if (animate) {
        if (!dragging) {
          world.rotation.y += spin + velocity
          velocity *= 0.94
        }
        // aircraft along the arc
        const f = (t / 14) % 1
        const idx = Math.min(arc.length - 2, Math.floor(f * (arc.length - 1)))
        const pos = arc[idx]
        const next = arc[idx + 1]
        plane.position.copy(pos)
        plane.lookAt(next)
        plane.rotateX(Math.PI / 2)
        const tailStart = Math.max(0, idx - 14)
        trailGeo.setFromPoints(arc.slice(tailStart, idx + 1))
        // marker pulse
        const s = 1 + Math.sin(t * 2.2) * 0.35
        for (const ring of pulseRings) {
          ring.scale.setScalar(s)
          ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.75 - (s - 1) * 0.9
        }
      } else {
        plane.position.copy(arc[Math.floor(arc.length * 0.4)])
        plane.lookAt(arc[Math.floor(arc.length * 0.4) + 1])
        plane.rotateX(Math.PI / 2)
      }
      scene.updateMatrixWorld()
      renderer.render(scene, camera)
      if (frame++ % 6 === 0) projectLabels()
    }

    const resize = () => {
      const w = mount.clientWidth || width
      camera.aspect = w / height
      camera.updateProjectionMatrix()
      renderer.setSize(w, height, false)
      renderFrame(false)
    }
    window.addEventListener('resize', resize)

    if (calm) {
      spin = 0
      renderFrame(false)
      projectLabels()
    } else {
      const loop = () => {
        renderFrame(true)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    setReady(true)
    pushLog('Orbital view initialised', 'core')

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      if (canDrag) {
        renderer.domElement.removeEventListener('pointerdown', onDown)
        renderer.domElement.removeEventListener('pointermove', onMove)
        renderer.domElement.removeEventListener('pointerup', onUp)
        renderer.domElement.removeEventListener('pointercancel', onUp)
      }
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // Rebuild only when the render budget or the motion policy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calm, perfTier, height])

  return (
    <div ref={viewport.ref} className="relative" style={{ height }}>
      <div ref={mountRef} className="absolute inset-0" style={{ opacity: viewport.visible ? 1 : 0.35, transition: 'opacity 400ms ease' }} />

      {/* projected labels */}
      {labels.map((label) => {
        const pos = screen[label.id]
        if (!pos) return null
        return (
          <div
            key={label.id}
            className="pointer-events-none absolute whitespace-nowrap transition-opacity duration-300"
            style={{
              left: pos.x,
              top: pos.y,
              transform:
                label.place === 'above' ? 'translate(-50%,-118%)' : 'translate(-50%,18%)',
              opacity: pos.visible ? 1 : 0,
            }}
          >
            {label.place === 'below' && (
              <div className="mx-auto h-3 w-px" style={{ background: `rgba(${label.tone},0.6)` }} />
            )}
            <div
              className="border px-1.5 py-0.5 font-display text-[0.5rem] font-bold tracking-[0.16em] whitespace-nowrap"
              style={{
                borderColor: `rgba(${label.tone},0.5)`,
                color: `rgb(${label.tone})`,
                background: 'rgba(4,8,13,0.78)',
              }}
            >
              {label.text}
            </div>
            {label.place === 'above' && (
              <div className="mx-auto h-3 w-px" style={{ background: `rgba(${label.tone},0.6)` }} />
            )}
          </div>
        )
      })}

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-2 top-2 font-mono text-[0.52rem] tracking-[0.2em] text-cyan/45">
          ORBITAL VIEW {ready ? '· LOCKED' : '· INIT'}
        </div>
        <div className="absolute bottom-2 right-2 font-mono text-[0.52rem] tracking-[0.2em] text-cyan/35">
          {perfTier === 'low' ? 'LITE MESH' : 'DRAG TO ROTATE'}
        </div>
      </div>
    </div>
  )
}
