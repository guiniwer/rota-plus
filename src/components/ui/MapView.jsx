// Mapa ilustrativo em SVG (o mesmo do Figma). Em produção seria trocado por Mapbox/Google Maps.
import { ROUTE, pointOnRoute } from '../../utils/mapa'

const BLOCKS = []
for (let x = 0; x < 1000; x += 90) for (let y = 0; y < 560; y += 80) BLOCKS.push([x + 8, y + 8])

/**
 * props:
 *  - progress: 0..1 posição do veículo na rota (null = sem rota)
 *  - markers: [{ id, x, y, color, label }]
 *  - onMarkerClick(marker)
 *  - height: altura em px
 *  - children: sobreposições (chips) posicionadas pelo chamador
 */
export default function MapView({ progress = 0.45, showRoute = true, markers = [], onMarkerClick, selectedId, height = 300, children }) {
  const v = pointOnRoute(progress)
  const done = [...ROUTE.slice(0, v.seg + 1), [v.x, v.y]]
  const rest = [[v.x, v.y], ...ROUTE.slice(v.seg + 1)]
  const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')

  return (
    <div className="map" style={{ height }}>
      <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa com a rota e os ativos">
        <rect width="1000" height="560" fill="#1E1238" />
        {BLOCKS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="74" height="64" rx="6" fill="#241645" />
        ))}
        <rect x="548" y="248" width="164" height="144" rx="10" fill="#1F3A35" />
        <path d="M0 470 C 200 420, 320 520, 520 470 S 820 400, 1000 440 L1000 520 C 820 480, 700 560, 520 540 S 200 500, 0 540 Z" fill="#1A2A4D" />
        <path d="M0 160 H1000 M0 320 H1000 M270 0 V560 M630 0 V560" stroke="#3A2A5C" strokeWidth="14" fill="none" />
        <path d="M60 560 L420 0" stroke="#3A2A5C" strokeWidth="10" fill="none" />

        {showRoute && (
          <>
            <path d={toPath(done)} stroke="#E856A6" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={toPath(rest)} stroke="#E856A6" strokeWidth="6" fill="none" strokeDasharray="2 14" strokeLinecap="round" />
            <circle cx="120" cy="400" r="12" fill="#8E64D8" stroke="#fff" strokeWidth="4" />
            <path d="M820 96 L805 72 A18 18 0 1 1 835 72 Z" fill="#E856A6" stroke="#fff" strokeWidth="3" />
            <circle cx="820" cy="62" r="6" fill="#fff" />
            <circle cx={v.x} cy={v.y} r="28" fill="#E856A6" fillOpacity="0.25">
              <animate attributeName="r" values="18;32;18" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={v.x} cy={v.y} r="13" fill="#E856A6" stroke="#fff" strokeWidth="4" />
          </>
        )}

        {markers.map((m) => (
          <g key={m.id} className="map-marker" onClick={() => onMarkerClick?.(m)}>
            <title>{m.label}</title>
            {selectedId === m.id && <circle cx={m.x} cy={m.y} r="20" fill="none" stroke="#fff" strokeWidth="3" />}
            <circle cx={m.x} cy={m.y} r="11" fill={m.color} stroke="#1A0D31" strokeWidth="3" />
          </g>
        ))}
      </svg>
      {children}
    </div>
  )
}

/** Chip posicionado sobre o mapa. */
export function MapChip({ children, style }) {
  return (
    <div className="map-overlay" style={style}>
      <span className="map-chip">{children}</span>
    </div>
  )
}
