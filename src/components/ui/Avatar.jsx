const COLORS = ['#8E64D8', '#E856A6', '#6E26E9', '#06B6D4', '#F5A524', '#4CAF50']

/** Avatar com iniciais (sem depender de imagens externas). */
export default function Avatar({ name = '?', size = 36 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  const color = COLORS[name.length % COLORS.length]
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  )
}
