// Rota usada pelo mapa ilustrativo (coordenadas do SVG 1000 × 560)
export const ROUTE = [
  [120, 400],
  [270, 400],
  [270, 320],
  [450, 320],
  [450, 160],
  [630, 160],
  [630, 90],
  [820, 90],
]

/** Posição ao longo da rota para um progresso entre 0 e 1. */
export function pointOnRoute(progress) {
  const segs = ROUTE.slice(1).map((p, i) => {
    const [x1, y1] = ROUTE[i]
    return { from: ROUTE[i], to: p, len: Math.hypot(p[0] - x1, p[1] - y1) }
  })
  const total = segs.reduce((s, x) => s + x.len, 0)
  let dist = Math.max(0, Math.min(1, progress)) * total
  for (const [i, s] of segs.entries()) {
    if (dist <= s.len) {
      const t = s.len ? dist / s.len : 0
      return { x: s.from[0] + (s.to[0] - s.from[0]) * t, y: s.from[1] + (s.to[1] - s.from[1]) * t, seg: i }
    }
    dist -= s.len
  }
  return { x: ROUTE.at(-1)[0], y: ROUTE.at(-1)[1], seg: segs.length - 1 }
}
