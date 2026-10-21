export default function ProgressBar({ value, color = 'var(--pink)', height = 8 }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="progress" style={{ height }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
