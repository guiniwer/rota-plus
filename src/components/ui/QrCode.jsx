/** QR ilustrativo gerado de forma determinística a partir do texto (apenas visual). */
export default function QrCode({ value, size = 140 }) {
  const n = 21
  let seed = [...value].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 100) / 100
  const finder = (x, y) => {
    const inBox = (ox, oy) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    const corner = [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ].find(([ox, oy]) => inBox(ox, oy))
    if (!corner) return null
    const dx = x - corner[0]
    const dy = y - corner[1]
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
  }
  const cells = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y)
      if (f ?? rand() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} role="img" aria-label={`QR Code ${value}`} style={{ background: '#fff', borderRadius: 12 }}>
      <g fill="#1A0D31">{cells}</g>
    </svg>
  )
}
