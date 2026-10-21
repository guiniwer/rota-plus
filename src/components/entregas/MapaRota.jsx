import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// textos vêm do banco: escapamos antes de montar o HTML do popup
const esc = (t = '') => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/**
 * Mapa real (OpenStreetMap + Leaflet) com a rota otimizada.
 * props: base { lat, lng, nome }, paradas [{ id, lat, lng, cliente }], trajeto [[lat, lng], ...], height
 */
export default function MapaRota({ base, paradas, trajeto, height = 320 }) {
  const elRef = useRef(null)
  const mapaRef = useRef(null)
  const camadaRef = useRef(null)

  // cria o mapa uma única vez
  useEffect(() => {
    const mapa = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa)
    camadaRef.current = L.layerGroup().addTo(mapa)
    mapaRef.current = mapa
    return () => mapa.remove()
  }, [])

  // redesenha quando a rota muda
  useEffect(() => {
    const mapa = mapaRef.current
    const camada = camadaRef.current
    if (!mapa || !base) return
    camada.clearLayers()
    const icone = (texto, classe) => L.divIcon({ className: '', html: `<span class="rota-pin ${classe}">${texto}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] })

    if (trajeto?.length > 1) L.polyline(trajeto, { color: '#E856A6', weight: 5, opacity: 0.9 }).addTo(camada)
    L.marker([base.lat, base.lng], { icon: icone('CD', 'base'), title: base.nome }).addTo(camada)
    paradas.forEach((p, i) => L.marker([p.lat, p.lng], { icon: icone(i + 1, ''), title: `${i + 1}. ${p.cliente}` }).bindPopup(`<b>${i + 1}. ${esc(p.cliente)}</b><br>${esc(p.destino)}`).addTo(camada))

    const pontos = [[base.lat, base.lng], ...paradas.map((p) => [p.lat, p.lng])]
    mapa.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 15 })
  }, [base, paradas, trajeto])

  return <div ref={elRef} className="mapa-rota" style={{ height }} role="region" aria-label="Mapa da rota otimizada" />
}
