import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeViz({ lat, lng }) {
  const globeRef = useRef()
  const containerRef = useRef()
  const [size, setSize] = useState({ w: 500, h: 500 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.pointOfView({ lat: 23.4, lng: 53.8, altitude: 2.5 })
  }, [])

  useEffect(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    controls.enableDamping = true
    controls.dampingFactor = 0.02
    controls.enableZoom = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.6

    function onInteract() {
      controls.autoRotate = false
    }
    controls.addEventListener('start', onInteract)
    return () => controls.removeEventListener('start', onInteract)
  }, [])

  useEffect(() => {
    if (!globeRef.current) return
    if (lat != null && lng != null) {
      const { altitude } = globeRef.current.pointOfView()
      globeRef.current.pointOfView({ lat, lng, altitude }, 1200)
    }
  }, [lat, lng])

  const points = lat != null ? [{ lat, lng }] : []
  const rings = lat != null ? [{ lat, lng }] : []

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
      onMouseDown={e => e.currentTarget.style.cursor = 'grabbing'}
      onMouseUp={e => e.currentTarget.style.cursor = 'grab'}
      onMouseLeave={e => e.currentTarget.style.cursor = 'grab'}
    >
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#aec6e8"
        atmosphereAltitude={0.15}
        pointsData={points}
        pointColor={() => '#ffffff'}
        pointRadius={0.4}
        pointAltitude={0.02}
        ringsData={rings}
        ringColor={() => () => 'rgba(255,255,255,0.9)'}
        ringMaxRadius={3}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={800}
        ringAltitude={0.01}
      />
    </div>
  )
}
