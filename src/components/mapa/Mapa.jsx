import { Suspense, lazy } from 'react'

// o Leaflet só é baixado quando um mapa aparece na tela
const MapaLeaflet = lazy(() => import('./MapaLeaflet'))

/** Mapa real (OpenStreetMap). Aceita sobreposições (chips) como filhos. Props: ver MapaLeaflet. */
export default function Mapa({ children, height = 320, ...props }) {
  return (
    <div className="mapa-wrap" style={{ height }}>
      <Suspense fallback={<div className="mapa-rota" style={{ height }} />}>
        <MapaLeaflet height={height} {...props} />
      </Suspense>
      {children}
    </div>
  )
}

/** Etiqueta flutuante sobre o mapa. */
export function MapChip({ children, style }) {
  return (
    <div className="map-overlay" style={style}>
      <span className="map-chip">{children}</span>
    </div>
  )
}
