import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * Drag-to-look viewer for equirectangular (360°) photos.
 *
 * The image is mapped onto the inside of a sphere with the camera at its
 * centre, which is what makes it read as standing inside the scene rather than
 * looking at a very wide picture. Only used for images Commons reports as
 * roughly 2:1 — anything else is shown as a normal photo.
 */
export function PanoramaViewer({ src, className = '' }: { src: string; className?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setFailed(true)
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 100)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(mount.clientWidth, mount.clientHeight, false)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.cssText =
      'display:block;width:100%;height:100%;cursor:grab;touch-action:none'

    // Sphere flipped inside-out so the texture faces the camera at its centre.
    const geometry = new THREE.SphereGeometry(50, 48, 32)
    geometry.scale(-1, 1, 1)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    let material: THREE.MeshBasicMaterial | null = null

    loader.load(
      src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        material = new THREE.MeshBasicMaterial({ map: texture })
        scene.add(new THREE.Mesh(geometry, material))
      },
      undefined,
      () => setFailed(true),
    )

    let lon = 0
    let lat = 0
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      renderer.domElement.style.cursor = 'grabbing'
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      lon -= (e.clientX - lastX) * 0.16
      lat += (e.clientY - lastY) * 0.16
      lat = Math.max(-85, Math.min(85, lat))
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      renderer.domElement.style.cursor = 'grab'
      try {
        renderer.domElement.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)

    let raf = 0
    const loop = () => {
      if (!dragging) lon += 0.02 // gentle drift so it reads as interactive
      const phi = THREE.MathUtils.degToRad(90 - lat)
      const theta = THREE.MathUtils.degToRad(lon)
      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      )
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const resize = () => {
      if (!mount.clientWidth) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight, false)
    }
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointercancel', onUp)
      geometry.dispose()
      material?.map?.dispose()
      material?.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [src])

  if (failed) return <img src={src} alt="" className={`${className} object-contain`} />

  return (
    <div className={`relative ${className}`}>
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 border border-cyan/30 bg-void/70 px-2 py-1 font-mono text-[0.55rem] tracking-[0.2em] text-cyan/70">
        360° · ZIEHEN ZUM UMSEHEN
      </div>
    </div>
  )
}
