import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import styles from './MapboxViz.module.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const DEFAULT_CENTER = [20, 25]
const DEFAULT_ZOOM = 1.8


export default function MapboxViz({ lat, lng }) {
  const containerRef = useRef()
  const mapRef = useRef()
  const markerRef = useRef()
  const readyRef = useRef(false)
  const coordsRef = useRef({ lat, lng })

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: DEFAULT_CENTER,
      zoom: 0,
      pitch: 0,
      bearing: 0,
      antialias: true,
      attributionControl: false,
      fadeDuration: 0,
      maxTileCacheSize: 1000,
      renderWorldCopies: false,
    })

    map.on('style.load', () => {
      map.setFog({
        'color': '#ffffff',
        'high-color': '#ffffff',
        'space-color': '#ffffff',
        'star-intensity': 0,
        'horizon-blend': 0.02,
      })
    })

    map.once('idle', () => {
      readyRef.current = true
      containerRef.current.classList.add(styles.ready)
      const { lat, lng } = coordsRef.current
      if (lat != null && lng != null) {
        markerRef.current.setLngLat([lng, lat]).addTo(map)
        map.flyTo({ center: [lng, lat], zoom: 13, pitch: 55, bearing: -15, duration: 7000, curve: 3, essential: true })
      } else {
        map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, pitch: 0, bearing: 0, duration: 4000, curve: 1, essential: true })
      }
    })

    mapRef.current = map
    markerRef.current = new mapboxgl.Marker({ color: '#000', scale: 0.7 })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)

    return () => { map.remove(); ro.disconnect() }
  }, [])

  useEffect(() => {
    coordsRef.current = { lat, lng }
  }, [lat, lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return

    if (lat != null && lng != null) {
      markerRef.current.setLngLat([lng, lat]).addTo(map)
      map.flyTo({
        center: [lng, lat],
        zoom: 13,
        pitch: 55,
        bearing: -15,
        duration: 7000,
        curve: 3,
        essential: true,
      })
    } else {
      markerRef.current.remove()
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0,
        duration: 4500,
        curve: 1,
        essential: true,
      })
    }
  }, [lat, lng])

  return <div ref={containerRef} className={styles.container} />
}
