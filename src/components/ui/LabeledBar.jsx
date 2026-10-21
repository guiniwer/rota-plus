import ProgressBar from './ProgressBar'

export default function LabeledBar({ label, value, percent, color }) {
  return (
    <div className="stack-sm" style={{ gap: 6 }}>
      <div className="row-between">
        <span className="small muted" style={{ fontSize: 13 }}>{label}</span>
        <strong style={{ fontSize: 13 }}>{value}</strong>
      </div>
      <ProgressBar value={percent} color={color} />
    </div>
  )
}
