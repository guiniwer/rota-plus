import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// textos vêm do banco: escapamos antes de montar o HTML dos marcadores e popups
const esc = (t = '') => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function icone(m) {
  const cor = m.cor ?? 'var(--pink)'
  const classe = ['mapa-pin', m.forma ?? 'ponto', m.selecionado && 'selecionado'].filter(Boolean).join(' ')
  const tam = m.forma === 'ponto' || !m.forma ? 18 : 30
  return L.divIcon({
    className: '',
    html: `<span class="${classe}" style="--cor:${esc(cor)}">${m.texto != null ? esc(m.texto) : ''}</span>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  })
}

/**
 * Mapa real (OpenStreetMap + Leaflet).
 * props:
 *  - marcadores: [{ id, lat, lng, cor?, forma?: 'ponto' | 'numero' | 'base' | 'veiculo', texto?, titulo?, popup? (linhas de texto), precisao? (m) }]
 *  - linhas: [{ pontos: [[lat, lng], ...], cor?, tracejada? }]
 *  - selecionadoId, onSelecionar(id)
 *  - chaveAjuste: quando muda, o mapa reenquadra todos os pontos (padrão: só na primeira vez)
 *  - height
 */
export default function MapaLeaflet({ marcadores = [], linhas = [], selecionadoId, onSelecionar, chaveAjuste, height = 320, rotulo = 'Mapa' }) {
  const elRef = useRef(null)
  const mapaRef = useRef(null)
  const camadaRef = useRef(null)
  const ajustadoRef = useRef(null)
  const onSelRef = useRef(onSelecionar)
  useEffect(() => {
    onSelRef.current = onSelecionar
  })

  // cria o mapa uma única vez
  useEffect(() => {
    const mapa = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true }).setView([-8.06, -34.9], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapa)
    camadaRef.current = L.layerGroup().addTo(mapa)
    mapaRef.current = mapa
    // o mapa pode nascer dentro de um modal/aba ainda sem tamanho
    const obs = new ResizeObserver(() => mapa.invalidateSize())
    obs.observe(elRef.current)
    return () => {
      obs.disconnect()
      mapa.remove()
    }
  }, [])

  // redesenha quando os dados mudam
  useEffect(() => {
    const mapa = mapaRef.current
    const camada = camadaRef.current
    if (!mapa) return
    camada.clearLayers()
    for (const l of linhas) {
      if (l.pontos?.length > 1) L.polyline(l.pontos, { color: l.cor ?? '#E856A6', weight: l.tracejada ? 3 : 5, opacity: 0.9, dashArray: l.tracejada ? '6 8' : null }).addTo(camada)
    }
    const validos = marcadores.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
    for (const m of validos) {
      if (m.precisao > 30) L.circle([m.lat, m.lng], { radius: m.precisao, color: m.cor ?? '#E856A6', weight: 1, fillOpacity: 0.08 }).addTo(camada)
      const mk = L.marker([m.lat, m.lng], { icon: icone({ ...m, selecionado: m.id === selecionadoId }), title: m.titulo ?? '', zIndexOffset: m.id === selecionadoId ? 1000 : 0 })
      if (m.popup?.length) mk.bindPopup(m.popup.map((linha, i) => (i === 0 ? `<b>${esc(linha)}</b>` : esc(linha))).join('<br>'))
      mk.on('click', () => onSelRef.current?.(m.id))
      mk.addTo(camada)
    }
    const chave = chaveAjuste ?? 'inicial'
    const pontos = [...validos.map((m) => [m.lat, m.lng]), ...linhas.flatMap((l) => l.pontos ?? [])]
    if (pontos.length && ajustadoRef.current !== chave) {
      ajustadoRef.current = chave
      if (pontos.length === 1) mapa.setView(pontos[0], 15)
      else mapa.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 15 })
    }
  }, [marcadores, linhas, selecionadoId, chaveAjuste])

  return <div ref={elRef} className="mapa-rota" style={{ height }} role="region" aria-label={rotulo} />
}
